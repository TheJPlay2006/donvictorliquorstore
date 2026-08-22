// Adaptador para el microservicio DDGS (image-search-agent/app.py).
//
// DDGS (DuckDuckGo Search) es una librería Python que permite buscar imágenes
// sin API key. Como Vercel Functions son Node.js y no pueden ejecutar Python
// directamente, este provider llama al microservicio Python vía HTTP.
//
// Habilitación: requiere DOS variables de entorno:
//   IMAGE_SEARCH_DDGS_ENABLED=true
//   IMAGE_SEARCH_DDGS_URL=https://tu-microservicio.railway.app
//
// Opcionales:
//   IMAGE_SEARCH_DDGS_TOKEN     — Bearer token si el microservicio lo requiere
//   IMAGE_SEARCH_DDGS_TIMEOUT_MS — timeout (default: 10000ms)
//   IMAGE_SEARCH_DDGS_MAX_RESULTS — máximo de candidatos por producto (default: 30)
//
// Manejo de errores:
//   - Circuit breaker local: 3 errores consecutivos → skip por el resto del import
//   - Timeout configurable
//   - No bloquea a otros proveedores si falla
"use strict";

const USER_AGENT = require("../userAgent");

const FUENTE = "ddgs";
const TIMEOUT_MS = Number(process.env.IMAGE_SEARCH_DDGS_TIMEOUT_MS) || 10000;
const MAX_RESULTS = Number(process.env.IMAGE_SEARCH_DDGS_MAX_RESULTS) || 30;
const CIRCUIT_MAX_ERRORES = 3;
const CIRCUIT_RESET_MS = 5 * 60 * 1000; // 5 minutos

// Circuit breaker local (por proceso de Vercel Function)
let erroresCircuito = 0;
let circuitoAbiertoDesde = null;

function circuitoEstaAbierto() {
    if (circuitoAbiertoDesde !== null) {
        if (Date.now() - circuitoAbiertoDesde > CIRCUIT_RESET_MS) {
            erroresCircuito = 0;
            circuitoAbiertoDesde = null;
            return false;
        }
        return true;
    }
    return false;
}

function registrarExito() {
    erroresCircuito = 0;
    circuitoAbiertoDesde = null;
}

function registrarError() {
    erroresCircuito++;
    if (erroresCircuito >= CIRCUIT_MAX_ERRORES && circuitoAbiertoDesde === null) {
        circuitoAbiertoDesde = Date.now();
    }
}

function estaConfigurado() {
    return (
        String(process.env.IMAGE_SEARCH_DDGS_ENABLED || "").toLowerCase() === "true" &&
        Boolean(process.env.IMAGE_SEARCH_DDGS_URL && process.env.IMAGE_SEARCH_DDGS_URL.trim())
    );
}

function construirHeaders() {
    const headers = {
        "content-type": "application/json",
        "user-agent": USER_AGENT
    };
    const token = process.env.IMAGE_SEARCH_DDGS_TOKEN;
    if (token) {
        headers["authorization"] = "Bearer " + token;
    }
    return headers;
}

function adaptarCandidato(item) {
    return {
        url: item.url || "",
        sourceUrl: item.source_url || null,
        sourceDomain: item.source_domain || "",
        title: item.title || "",
        fuente: FUENTE,
        license: null,  // DDGS no garantiza licencia → nunca puede ser "alta" automáticamente
        width: item.width || null,
        height: item.height || null
    };
}

// buscar(query, opciones) es el contrato del provider para búsqueda por texto.
// opciones.producto puede usarse para enviar más contexto al microservicio.
async function buscar(query, opciones) {
    if (circuitoEstaAbierto()) {
        throw new Error("DDGS circuit breaker abierto. Proveedor omitido.");
    }

    const baseUrl = String(process.env.IMAGE_SEARCH_DDGS_URL || "").replace(/\/$/, "");
    const url = baseUrl + "/search";

    const producto = (opciones && opciones.producto) || {};
    const payload = {
        name: producto.nombre || query,
        brand: producto.marca || null,
        presentation: producto.presentacion || null,
        category: producto.categoria || null,
        max_results: MAX_RESULTS,
        force: (opciones && opciones.forzar) || false
    };

    const controlador = new AbortController();
    const idTimeout = setTimeout(() => controlador.abort(), TIMEOUT_MS);

    let respuesta;
    try {
        respuesta = await fetch(url, {
            method: "POST",
            signal: controlador.signal,
            headers: construirHeaders(),
            body: JSON.stringify(payload)
        });
    } catch (error) {
        clearTimeout(idTimeout);
        registrarError();
        const mensaje = error.name === "AbortError"
            ? "Tiempo de espera agotado consultando microservicio DDGS."
            : "Error de red al consultar microservicio DDGS: " + error.message;
        throw new Error(mensaje);
    } finally {
        clearTimeout(idTimeout);
    }

    if (respuesta.status === 503) {
        registrarError();
        const error = new Error("Microservicio DDGS respondió 503 (circuit breaker del microservicio abierto).");
        error.retryAfterMs = 30000; // esperar 30s antes de reintentar
        throw error;
    }

    if (respuesta.status === 429) {
        registrarError();
        const error = new Error("Microservicio DDGS respondió 429 (rate limit).");
        error.retryAfterMs = null;
        throw error;
    }

    if (!respuesta.ok) {
        registrarError();
        throw new Error("Microservicio DDGS respondió " + respuesta.status + ".");
    }

    const datos = await respuesta.json();
    registrarExito();

    const candidatos = (datos.candidates || []).map(adaptarCandidato).filter((c) => c.url);
    return candidatos;
}

module.exports = {
    buscar,
    estaConfigurado,
    circuitoEstaAbierto,
    FUENTE
};
