// Adaptador para Exa Search API (https://exa.ai) — instalado vía Vercel
// Marketplace (categoría "searching"). Implementa la interfaz común
// ImageSearchProvider: buscar(query) -> [{ url, sourceUrl, sourceDomain, title }].
//
// Contrato real de Exa (verificado contra su documentación, no asumido):
//   POST https://api.exa.ai/search
//   header: x-api-key: <EXA_API_KEY>
//   body: { query, numResults, contents: { extras: { imageLinks } } }
//   respuesta: { results: [{ title, url, image, ... }] }
// `results[].image` es la imagen representativa de esa página; no hay ancho/
// alto en la respuesta (por eso el chequeo de dimensiones ocurre recién al
// descargar la imagen elegida, ver _lib/imagenPipeline.js).
"use strict";

const ENDPOINT = "https://api.exa.ai/search";
const TIMEOUT_MS = 8000;

class ErrorProveedorNoConfigurado extends Error {}
class ErrorProveedorRateLimit extends Error {
    constructor(message, retryAfterMs) {
        super(message);
        this.retryAfterMs = retryAfterMs || null;
    }
}
class ErrorProveedorSinCredito extends Error {}

function estaConfigurado() {
    return !!process.env.EXA_API_KEY;
}

function extraerDominio(urlTexto) {
    try {
        return new URL(urlTexto).hostname.replace(/^www\./, "").toLowerCase();
    } catch (error) {
        return "";
    }
}

async function buscar(query, opciones) {
    const limite = (opciones && opciones.limite) || 6;
    const apiKey = process.env.EXA_API_KEY;

    if (!apiKey) {
        throw new ErrorProveedorNoConfigurado("EXA_API_KEY no está configurada.");
    }

    const controlador = new AbortController();
    const idTimeout = setTimeout(() => controlador.abort(), TIMEOUT_MS);

    let respuesta;
    try {
        respuesta = await fetch(ENDPOINT, {
            method: "POST",
            signal: controlador.signal,
            headers: {
                "content-type": "application/json",
                "x-api-key": apiKey
            },
            body: JSON.stringify({
                query: query,
                numResults: limite,
                contents: { extras: { imageLinks: 2 } }
            })
        });
    } catch (error) {
        throw new Error(error.name === "AbortError" ? "Tiempo de espera agotado buscando en Exa." : "Error de red al llamar a Exa: " + error.message);
    } finally {
        clearTimeout(idTimeout);
    }

    if (respuesta.status === 429) {
        const retryAfterHeader = Number(respuesta.headers.get("retry-after"));
        throw new ErrorProveedorRateLimit("Exa devolvió 429 (rate limit).", isNaN(retryAfterHeader) ? null : retryAfterHeader * 1000);
    }

    if (respuesta.status === 402) {
        throw new ErrorProveedorSinCredito("Exa devolvió 402 (sin crédito/billing).");
    }

    if (!respuesta.ok) {
        throw new Error("Exa respondió " + respuesta.status + ".");
    }

    const datos = await respuesta.json();
    const candidatos = [];

    (datos.results || []).forEach((resultado) => {
        const dominio = extraerDominio(resultado.url || "");

        if (resultado.image) {
            candidatos.push({
                url: resultado.image,
                sourceUrl: resultado.url,
                sourceDomain: dominio,
                title: resultado.title || ""
            });
        }

        const imagenesExtra = resultado.extras && Array.isArray(resultado.extras.imageLinks)
            ? resultado.extras.imageLinks
            : [];

        imagenesExtra.forEach((imagenUrl) => {
            if (imagenUrl && imagenUrl !== (resultado.image || "")) {
                candidatos.push({
                    url: imagenUrl,
                    sourceUrl: resultado.url,
                    sourceDomain: dominio,
                    title: resultado.title || ""
                });
            }
        });
    });

    return candidatos;
}

module.exports = {
    buscar: buscar,
    estaConfigurado: estaConfigurado,
    ErrorProveedorNoConfigurado: ErrorProveedorNoConfigurado,
    ErrorProveedorRateLimit: ErrorProveedorRateLimit,
    ErrorProveedorSinCredito: ErrorProveedorSinCredito
};
