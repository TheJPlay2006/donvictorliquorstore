// Adaptador para Wikimedia Commons — gratuito, sin API key, vía la API
// oficial de MediaWiki (nunca scraping HTML).
//
// Contrato verificado con peticiones reales en vivo:
//   GET https://commons.wikimedia.org/w/api.php
//       ?action=query&generator=search&gsrsearch=<query>&gsrnamespace=6
//       &gsrlimit=N&prop=imageinfo&iiprop=url|size|mime|extmetadata
//       &iiurlwidth=300&format=json
// `gsrnamespace=6` restringe la búsqueda al namespace "File:" (§9). La
// licencia/autor/atribución vienen en `imageinfo[0].extmetadata`
// (LicenseShortName, LicenseUrl, Artist, Credit) — HTML con enlaces, por eso
// se les quita el markup antes de guardarlos (§38).
"use strict";

const USER_AGENT = require("../userAgent");

const ENDPOINT = "https://commons.wikimedia.org/w/api.php";
const TIMEOUT_MS = 8000;
const FUENTE = "wikimedia";
const DIMENSION_MINIMA = 300;
// Wikimedia Commons también indexa TIFF/SVG/GIF/audio bajo el namespace
// File:. Solo interesan los formatos que el pipeline de descarga (§33)
// realmente acepta — un candidato en un formato no soportado fallaría al
// intentar importarlo, así que ni se ofrece como opción.
const MIME_PERMITIDOS = ["image/jpeg", "image/png", "image/webp"];

function estaConfigurado() {
    return true;
}

function quitarHtml(valor) {
    return String(valor || "").replace(/<[^>]*>/g, "").trim();
}

function valorMetadata(extmetadata, clave) {
    return extmetadata && extmetadata[clave] ? extmetadata[clave].value : null;
}

async function buscar(query, opciones) {
    const limite = (opciones && opciones.limite) || 5;

    const parametros = new URLSearchParams({
        action: "query",
        generator: "search",
        gsrsearch: query,
        gsrnamespace: "6",
        gsrlimit: String(limite),
        prop: "imageinfo",
        iiprop: "url|size|mime|extmetadata",
        iiurlwidth: "300",
        format: "json",
        origin: "*"
    });

    const controlador = new AbortController();
    const idTimeout = setTimeout(() => controlador.abort(), TIMEOUT_MS);

    let respuesta;
    try {
        respuesta = await fetch(ENDPOINT + "?" + parametros.toString(), {
            signal: controlador.signal,
            headers: { "user-agent": USER_AGENT }
        });
    } catch (error) {
        throw new Error(error.name === "AbortError" ? "Tiempo de espera agotado consultando Wikimedia Commons." : "Error de red al consultar Wikimedia: " + error.message);
    } finally {
        clearTimeout(idTimeout);
    }

    if (respuesta.status === 429 || respuesta.status === 503) {
        const error = new Error("Wikimedia respondió " + respuesta.status + ".");
        error.retryAfterMs = null;
        throw error;
    }

    if (!respuesta.ok) {
        throw new Error("Wikimedia respondió " + respuesta.status + ".");
    }

    const datos = await respuesta.json();
    const paginas = (datos.query && datos.query.pages) || {};

    const candidatos = [];

    Object.keys(paginas).forEach((clave) => {
        const pagina = paginas[clave];
        const info = pagina.imageinfo && pagina.imageinfo[0];
        if (!info || !info.url) { return; }
        if (MIME_PERMITIDOS.indexOf(info.mime) === -1) { return; }
        if ((info.width || 0) < DIMENSION_MINIMA && (info.height || 0) < DIMENSION_MINIMA) { return; }

        const extmetadata = info.extmetadata || {};
        const titulo = String(pagina.title || "").replace(/^File:/, "");

        candidatos.push({
            url: info.url,
            thumbnail: info.thumburl || null,
            width: info.width || null,
            height: info.height || null,
            mime: info.mime,
            title: titulo,
            sourceUrl: info.descriptionurl || null,
            sourceDomain: "commons.wikimedia.org",
            fuente: FUENTE,
            license: valorMetadata(extmetadata, "LicenseShortName"),
            licenseUrl: valorMetadata(extmetadata, "LicenseUrl"),
            author: quitarHtml(valorMetadata(extmetadata, "Artist")),
            credit: quitarHtml(valorMetadata(extmetadata, "Credit")),
            description: quitarHtml(valorMetadata(extmetadata, "ImageDescription"))
        });
    });

    return candidatos;
}

module.exports = { buscar, estaConfigurado, FUENTE };
