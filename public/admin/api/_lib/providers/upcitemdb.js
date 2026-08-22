// Adaptador para UPCitemdb (https://www.upcitemdb.com) — trial gratuito sin
// API key, pero con cuota MUY chica (verificado en vivo: 100 requests/día,
// compartida entre TODOS los imports del admin). Por eso se usa solo como
// proveedor de "etapa profunda" (último recurso), nunca en la etapa normal,
// y respeta X-RateLimit-Remaining para dejar de pedir antes de agotar la
// cuota del día.
//
// IMPORTANTE (§59): las fotos que devuelve son de catálogos de retail
// (Walmart, etc.), sin licencia explícita de reuso. `license` queda null a
// propósito — scoring.js nunca deja que una fuente sin licencia conocida
// llegue a confianza "alta", sin importar qué tan bien matchee el texto.
"use strict";

const USER_AGENT = require("../userAgent");

const ENDPOINT_LOOKUP = "https://api.upcitemdb.com/prod/trial/lookup";
const ENDPOINT_SEARCH = "https://api.upcitemdb.com/prod/trial/search";
const TIMEOUT_MS = 8000;
const FUENTE = "upcitemdb";
const CUOTA_MINIMA_RESTANTE = 5; // por debajo de esto, se deja de consultar por el resto del día/import

let cuotaRestanteConocida = null;

function estaConfigurado() {
    return true; // trial no requiere key
}

function actualizarCuotaDesdeRespuesta(respuesta) {
    const restante = Number(respuesta.headers.get("x-ratelimit-remaining"));
    if (!isNaN(restante)) { cuotaRestanteConocida = restante; }
}

function cuotaAgotada() {
    return cuotaRestanteConocida !== null && cuotaRestanteConocida <= CUOTA_MINIMA_RESTANTE;
}

function extraerDominio(urlTexto) {
    try {
        return new URL(urlTexto).hostname.replace(/^www\./, "").toLowerCase();
    } catch (error) {
        return "";
    }
}

function itemsAImagenes(items) {
    const candidatos = [];
    (items || []).forEach((item) => {
        (item.images || []).slice(0, 3).forEach((url) => {
            candidatos.push({
                url: url,
                sourceUrl: (item.offers && item.offers[0] && item.offers[0].link) || null,
                sourceDomain: (item.offers && item.offers[0] && item.offers[0].domain) || extraerDominio(url),
                title: item.title || "",
                fuente: FUENTE,
                license: null, // a propósito: sin licencia conocida, ver cabecera del archivo
                upcitemdbBrand: item.brand || "",
                upcitemdbEan: item.ean || item.upc || null
            });
        });
    });
    return candidatos;
}

async function llamar(url, params) {
    if (cuotaAgotada()) {
        throw new Error("Cuota diaria de UPCitemdb agotada, se omite por el resto de este import.");
    }

    const controlador = new AbortController();
    const idTimeout = setTimeout(() => controlador.abort(), TIMEOUT_MS);

    let respuesta;
    try {
        respuesta = await fetch(url + "?" + params.toString(), {
            signal: controlador.signal,
            headers: { "user-agent": USER_AGENT, accept: "application/json" }
        });
    } catch (error) {
        throw new Error(error.name === "AbortError" ? "Tiempo de espera agotado consultando UPCitemdb." : "Error de red al consultar UPCitemdb: " + error.message);
    } finally {
        clearTimeout(idTimeout);
    }

    actualizarCuotaDesdeRespuesta(respuesta);

    if (respuesta.status === 429) {
        const retryAfterHeader = Number(respuesta.headers.get("retry-after"));
        const error = new Error("UPCitemdb respondió 429 (rate limit).");
        error.retryAfterMs = isNaN(retryAfterHeader) ? null : retryAfterHeader * 1000;
        throw error;
    }
    if (!respuesta.ok) {
        throw new Error("UPCitemdb respondió " + respuesta.status + ".");
    }

    return respuesta.json();
}

async function buscarPorBarcode(barcode) {
    const datos = await llamar(ENDPOINT_LOOKUP, new URLSearchParams({ upc: barcode }));
    return itemsAImagenes(datos.items);
}

// Además de imágenes, permite "descubrir" un EAN/UPC cuando el CSV no trae
// barcode (§46): se usa por separado en el resolver, no acá.
async function buscarPorTexto(query, opciones) {
    const limite = (opciones && opciones.limite) || 10;
    const datos = await llamar(ENDPOINT_SEARCH, new URLSearchParams({ s: query, type: "product" }));
    return itemsAImagenes((datos.items || []).slice(0, limite));
}

async function descubrirBarcode(query, terminosMatch) {
    const datos = await llamar(ENDPOINT_SEARCH, new URLSearchParams({ s: query, type: "product" }));
    const items = datos.items || [];
    if (items.length === 0) { return null; }

    // Solo se acepta el barcode "descubierto" si la marca coincide
    // claramente — de lo contrario es demasiado arriesgado usarlo (§46).
    const marcaBuscada = String((terminosMatch && terminosMatch.marca) || "").toLowerCase();
    const candidato = items.find((item) => marcaBuscada && String(item.brand || "").toLowerCase().indexOf(marcaBuscada) !== -1) || null;

    if (!candidato) { return null; }
    return candidato.ean || candidato.upc || null;
}

module.exports = {
    buscar: buscarPorTexto,
    buscarPorBarcode,
    descubrirBarcode,
    estaConfigurado,
    cuotaAgotada,
    FUENTE
};
