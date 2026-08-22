// Scoring de candidatos de imagen encontrados por búsqueda automática. Lógica
// pura (sin red, sin DB) para que sea fácil de testear de forma aislada —
// ver api/_lib/scoring.test.js.
"use strict";

// Dominios de fabricantes/distribuidores/catálogos de licores conocidos por
// tender a mostrar fotos limpias del producto (botella sola, buen fondo).
// No es una lista cerrada ni excluyente: solo suma puntos, nunca descarta un
// candidato por no estar acá (evitar dejar productos sin imagen solo porque
// la fuente no está en esta lista).
const DOMINIOS_CONFIABLES = [
    "totalwine.com", "thewhiskyexchange.com", "masterofmalt.com", "wine.com",
    "drizly.com", "reservebar.com", "klwines.com", "thedrinkshop.com",
    "wikipedia.org", "diageo.com", "pernod-ricard.com", "absolut.com",
    "bacardi.com", "brown-forman.com", "remy-cointreau.com", "campari.com",
    "beveragedynasty.com", "finedrams.com", "liquorama.net"
];

// Dominios de bancos de imágenes/redes sociales: suelen devolver fotos de
// estilo de vida, memes o contenido no representativo del producto en sí.
const DOMINIOS_PENALIZADOS = [
    "pinterest.", "instagram.com", "facebook.com", "twitter.com", "x.com",
    "tiktok.com", "istockphoto.com", "shutterstock.com", "gettyimages.com",
    "alamy.com", "reddit.com", "youtube.com"
];

// Palabras que sugieren que la foto no es del producto en sí (gente, íconos
// de marca, banners promocionales) sino de un contexto alrededor de él.
const PALABRAS_PENALIZADAS = [
    "banner", "poster", "cheers", "toast", "people", "model", "recipe",
    "cocktail party", "menu", "advertisement", "logo only"
];

function normalizarTexto(texto) {
    return String(texto || "")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .trim();
}

function tokenizar(texto) {
    return normalizarTexto(texto)
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length >= 2);
}

function extraerDominio(urlTexto) {
    try {
        return new URL(urlTexto).hostname.replace(/^www\./, "").toLowerCase();
    } catch (error) {
        return "";
    }
}

function coincideDominio(dominio, lista) {
    return lista.some((patron) => dominio === patron || dominio.endsWith("." + patron) || dominio.indexOf(patron) !== -1);
}

// terminos: { marca, nombre, presentacion, codigo, barcode }
// candidato: { title, url, sourceUrl, sourceDomain }
function calcularScore(candidato, terminos) {
    const razones = [];
    let score = 0;

    const textoCandidato = normalizarTexto((candidato.title || "") + " " + (candidato.sourceUrl || candidato.url || ""));
    const dominio = candidato.sourceDomain || extraerDominio(candidato.sourceUrl || candidato.url || "");

    if (terminos.marca) {
        const tokensMarca = tokenizar(terminos.marca);
        const encontrados = tokensMarca.filter((t) => textoCandidato.indexOf(t) !== -1);
        if (tokensMarca.length > 0 && encontrados.length === tokensMarca.length) {
            score += 30;
            razones.push("marca coincide (+30)");
        } else if (encontrados.length > 0) {
            score += 15;
            razones.push("marca coincide parcialmente (+15)");
        }
    }

    if (terminos.nombre) {
        const tokensNombre = tokenizar(terminos.nombre);
        const relevantes = tokensNombre.filter((t) => t.length >= 3);
        const base = relevantes.length || tokensNombre.length;
        if (base > 0) {
            const encontrados = (relevantes.length ? relevantes : tokensNombre).filter((t) => textoCandidato.indexOf(t) !== -1);
            const proporcion = encontrados.length / base;
            const puntos = Math.round(proporcion * 40);
            if (puntos > 0) {
                score += puntos;
                razones.push("nombre del producto coincide " + Math.round(proporcion * 100) + "% (+" + puntos + ")");
            }
        }
    }

    if (terminos.presentacion) {
        const presentacionNormalizada = normalizarTexto(terminos.presentacion).replace(/\s+/g, "");
        const candidatoSinEspacios = textoCandidato.replace(/\s+/g, "");
        if (presentacionNormalizada && candidatoSinEspacios.indexOf(presentacionNormalizada) !== -1) {
            score += 15;
            razones.push("presentación coincide (+15)");
        }
    }

    if (dominio) {
        if (coincideDominio(dominio, DOMINIOS_CONFIABLES)) {
            score += 10;
            razones.push("fuente confiable: " + dominio + " (+10)");
        } else if (coincideDominio(dominio, DOMINIOS_PENALIZADOS)) {
            score -= 25;
            razones.push("fuente de banco de imágenes/red social: " + dominio + " (-25)");
        }
    }

    const contienePalabraPenalizada = PALABRAS_PENALIZADAS.some((palabra) => textoCandidato.indexOf(palabra) !== -1);
    if (contienePalabraPenalizada) {
        score -= 20;
        razones.push("título sugiere contenido no-producto (-20)");
    }

    if (textoCandidato.indexOf("logo") !== -1) {
        score -= 15;
        razones.push("posible logo, no botella (-15)");
    }

    score = Math.max(0, Math.min(100, score));

    return { score: score, razones: razones, dominio: dominio };
}

function confianzaDeScore(score) {
    if (score >= 65) { return "alta"; }
    if (score >= 35) { return "media"; }
    return "baja";
}

// Ordena y anota candidatos con su score/confianza. `terminos` son los datos
// del producto usados para hacer matching (ver calcularScore).
function evaluarCandidatos(candidatos, terminos) {
    return candidatos
        .map((candidato) => {
            const resultado = calcularScore(candidato, terminos);
            return Object.assign({}, candidato, {
                score: resultado.score,
                confianza: confianzaDeScore(resultado.score),
                razones: resultado.razones,
                sourceDomain: resultado.dominio
            });
        })
        .sort((a, b) => b.score - a.score);
}

module.exports = { calcularScore, confianzaDeScore, evaluarCandidatos, tokenizar, normalizarTexto, extraerDominio };
