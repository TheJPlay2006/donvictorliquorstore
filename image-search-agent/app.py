"""
image-search-agent/app.py
Microservicio FastAPI que expone búsqueda de imágenes de productos de licores
a través de DuckDuckGo (DDGS) — gratuito, sin API key.

Despliega en Railway, Render o Fly.io. El provider Node.js `ddgs.js` lo
llama desde Vercel Functions cuando las otras fuentes no alcanzan.

Endpoints:
  POST /search   — buscar imágenes para un producto
  GET  /health   — estado del servicio y del circuit breaker
"""
import os
import re
import time
import hashlib
import asyncio
import unicodedata
from typing import Optional
from collections import OrderedDict
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from ddgs import DDGS

# ---------------------------------------------------------------------------
# Configuración via variables de entorno
# ---------------------------------------------------------------------------
MAX_RESULTS: int = int(os.getenv("DDGS_MAX_RESULTS", "30"))
MIN_WIDTH: int = int(os.getenv("DDGS_MIN_WIDTH", "400"))
MIN_HEIGHT: int = int(os.getenv("DDGS_MIN_HEIGHT", "400"))
CACHE_TTL_SECONDS: int = int(os.getenv("DDGS_CACHE_TTL_DAYS", "7")) * 86400
CACHE_MAX_ENTRIES: int = int(os.getenv("DDGS_CACHE_MAX", "2000"))
CIRCUIT_MAX_ERRORS: int = int(os.getenv("DDGS_CIRCUIT_MAX_ERRORS", "5"))
CIRCUIT_RESET_SECONDS: int = int(os.getenv("DDGS_CIRCUIT_RESET_SECONDS", "600"))
SEMAPHORE_LIMIT: int = int(os.getenv("DDGS_CONCURRENCY", "2"))
API_TOKEN: Optional[str] = os.getenv("DDGS_API_TOKEN")

# ---------------------------------------------------------------------------
# Estado global
# ---------------------------------------------------------------------------
_semaphore: asyncio.Semaphore
_circuit_errors: int = 0
_circuit_open_since: Optional[float] = None
_cache: OrderedDict = OrderedDict()  # LRU cache sencilla


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _semaphore
    _semaphore = asyncio.Semaphore(SEMAPHORE_LIMIT)
    yield


app = FastAPI(
    title="Don Victor Image Search Agent",
    description="Busqueda de imagenes de productos de licores mediante DuckDuckGo",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Modelos
# ---------------------------------------------------------------------------

class SearchRequest(BaseModel):
    name: str
    brand: Optional[str] = None
    presentation: Optional[str] = None
    category: Optional[str] = None
    max_results: Optional[int] = None
    force: bool = False


class ImageCandidate(BaseModel):
    url: str
    title: str
    source_url: Optional[str] = None
    source_domain: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None
    fuente: str = "ddgs"
    license: None = None


class SearchResponse(BaseModel):
    candidates: list[ImageCandidate]
    queries_used: list[str]
    cache_hit: bool
    total_found: int

# ---------------------------------------------------------------------------
# Normalizacion y generacion de queries
# ---------------------------------------------------------------------------

ES_EN_ALIASES = [
    (r'anos?\b', 'years'),
    (r'anejo\b', 'anejo'),
    (r'extra anejo\b', 'extra anejo'),
    (r'blanco\b', 'white'),
    (r'plata\b', 'silver'),
    (r'ron\b', 'rum'),
    (r'ginebra\b', 'gin'),
    (r'cerveza\b', 'beer'),
    (r'vino\b', 'wine'),
    (r'espumante\b', 'sparkling wine'),
    (r'reserva\b', 'reserve'),
]

CATEGORY_EN = {
    "ron": "rum",
    "whisky y bourbon": "whisky bourbon",
    "whisky": "whisky",
    "bourbon": "bourbon",
    "tequila": "tequila",
    "mezcal": "mezcal",
    "vodka": "vodka",
    "gin": "gin",
    "licor": "liqueur",
    "vino": "wine",
    "champagne": "champagne sparkling wine",
    "espumante": "sparkling wine",
    "cerveza": "beer",
    "brandy": "brandy",
    "cognac": "cognac",
}


def normalize(text: str) -> str:
    nfkd = unicodedata.normalize("NFD", text)
    ascii_str = "".join(c for c in nfkd if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", ascii_str.lower()).strip()


def apply_aliases(text: str) -> Optional[str]:
    result = text
    for pattern, replacement in ES_EN_ALIASES:
        result = re.sub(pattern, replacement, result, flags=re.IGNORECASE)
    return result if normalize(result) != normalize(text) else None


def extract_domain(url: str) -> str:
    try:
        from urllib.parse import urlparse
        return urlparse(url).hostname or ""
    except Exception:
        return ""


def build_queries(req: SearchRequest) -> list[str]:
    name = req.name.strip()
    brand = (req.brand or "").strip()
    pres = (req.presentation or "").strip()
    cat = (req.category or "").strip().lower()

    parts = [name]
    if pres:
        parts.append(pres)
    parts.append("bottle")
    q1 = " ".join(parts)

    queries: list[str] = [q1]

    q2 = apply_aliases(q1)
    if q2 and normalize(q2) != normalize(q1):
        queries.append(q2)

    if brand and cat:
        cat_en = CATEGORY_EN.get(cat, cat)
        age_match = re.search(r'\b(\d{1,2})\s*(?:anos?|years?|yrs?)', name, re.IGNORECASE)
        q3_parts = [brand, cat_en]
        if age_match:
            q3_parts.append(age_match.group(1) + " year")
        q3_parts.append("bottle")
        q3 = " ".join(q3_parts)
        if normalize(q3) not in [normalize(x) for x in queries]:
            queries.append(q3)

    if pres and normalize(name + " bottle") not in [normalize(x) for x in queries]:
        queries.append(name + " bottle")

    return queries[:4]


def make_cache_key(req: SearchRequest) -> str:
    text = normalize(f"{req.brand}:{req.name}:{req.presentation}:{req.category}")
    return "ddgs:v1:" + hashlib.sha256(text.encode()).hexdigest()[:32]


# ---------------------------------------------------------------------------
# Cache LRU simple
# ---------------------------------------------------------------------------

def cache_get(key: str) -> Optional[list]:
    if key in _cache:
        entry = _cache[key]
        if time.time() - entry["ts"] < CACHE_TTL_SECONDS:
            _cache.move_to_end(key)
            return entry["data"]
        del _cache[key]
    return None


def cache_set(key: str, data: list):
    if len(_cache) >= CACHE_MAX_ENTRIES:
        _cache.popitem(last=False)
    _cache[key] = {"ts": time.time(), "data": data}
    _cache.move_to_end(key)


# ---------------------------------------------------------------------------
# Circuit breaker
# ---------------------------------------------------------------------------

def circuit_is_open() -> bool:
    global _circuit_errors, _circuit_open_since
    if _circuit_open_since is not None:
        if time.time() - _circuit_open_since > CIRCUIT_RESET_SECONDS:
            _circuit_errors = 0
            _circuit_open_since = None
            return False
        return True
    return False


def circuit_record_success():
    global _circuit_errors, _circuit_open_since
    _circuit_errors = 0
    _circuit_open_since = None


def circuit_record_error():
    global _circuit_errors, _circuit_open_since
    _circuit_errors += 1
    if _circuit_errors >= CIRCUIT_MAX_ERRORS and _circuit_open_since is None:
        _circuit_open_since = time.time()


# ---------------------------------------------------------------------------
# Busqueda real via DDGS
# ---------------------------------------------------------------------------

def _search_sync(query: str, max_results: int) -> list[dict]:
    results = DDGS().images(
        query,
        max_results=max_results,
        safesearch="moderate",
        region="us-en",
    )
    return results or []


async def search_ddgs(query: str, max_results: int) -> list[dict]:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _search_sync, query, max_results)


def filter_and_adapt(results: list[dict]) -> list[ImageCandidate]:
    seen_urls: set[str] = set()
    candidates: list[ImageCandidate] = []

    for r in results:
        url = r.get("image") or r.get("url") or ""
        if not url or url in seen_urls:
            continue

        width = r.get("width") or 0
        height = r.get("height") or 0

        if width and height and (width < MIN_WIDTH or height < MIN_HEIGHT):
            continue

        seen_urls.add(url)
        source_url = r.get("url") or r.get("source") or None
        candidates.append(ImageCandidate(
            url=url,
            title=r.get("title") or "",
            source_url=source_url,
            source_domain=extract_domain(source_url or url),
            width=width or None,
            height=height or None,
        ))

    return candidates


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    return {
        "status": "ok" if not circuit_is_open() else "degraded",
        "circuit_open": circuit_is_open(),
        "circuit_errors": _circuit_errors,
        "cache_entries": len(_cache),
        "ddgs_version": "9.x",
    }


@app.post("/search", response_model=SearchResponse)
async def search(req: SearchRequest):
    if circuit_is_open():
        raise HTTPException(503, detail="DDGS circuit breaker open. Retry after a few minutes.")

    limit = min(req.max_results or MAX_RESULTS, 50)
    cache_key = make_cache_key(req)

    if not req.force:
        cached = cache_get(cache_key)
        if cached is not None:
            return SearchResponse(
                candidates=cached,
                queries_used=[],
                cache_hit=True,
                total_found=len(cached),
            )

    queries = build_queries(req)
    all_candidates: list[ImageCandidate] = []
    seen_urls: set[str] = set()

    async with _semaphore:
        for query in queries:
            if len(all_candidates) >= limit:
                break
            try:
                remaining = limit - len(all_candidates)
                results = await search_ddgs(query, max_results=remaining + 5)
                circuit_record_success()
                for c in filter_and_adapt(results):
                    if c.url not in seen_urls and len(all_candidates) < limit:
                        seen_urls.add(c.url)
                        all_candidates.append(c)
            except Exception as e:
                circuit_record_error()
                if circuit_is_open():
                    raise HTTPException(503, detail=f"DDGS circuit breaker opened: {e}")
                continue

    if all_candidates:
        cache_set(cache_key, all_candidates)

    return SearchResponse(
        candidates=all_candidates,
        queries_used=queries,
        cache_hit=False,
        total_found=len(all_candidates),
    )
