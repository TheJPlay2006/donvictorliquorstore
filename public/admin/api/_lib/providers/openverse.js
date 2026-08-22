// Adaptador para Openverse (https://openverse.org) — gratuito, funciona de
// forma ANÓNIMA (sin OPENVERSE_CLIENT_ID/SECRET). Si esas credenciales
// existen, se usan para pedir un token OAuth2 y tener más cuota; si falla
// por cualquier motivo, se sigue de forma anónima sin romper nada (son
// opcionales, nunca obligatorias — §10/§39).
//
// Contrato verificado con una petición real en vivo:
//   GET https://api.openverse.org/v1/images/?q=<query>&license_type=commercial&page_size=N
//   respuesta: { result_count, results: [{ id, title, foreign_landing_url,
//     url, creator, creator_url, license, license_version, license_url,
//     provider, source, filesize, filetype, width, height, thumbnail,
//     attribution }] }
// `license_type=commercial` ya excluye NC en el propio servidor; igual se
// vuelve a validar del lado nuestro (§11/§37: nunca confiar ciegamente en
// que una fuente externa filtró bien, y excluir también ND porque
// redimensionar/convertir la imagen es una obra derivada).
"use strict";

const USER_AGENT = require("../userAgent");

const ENDPOINT = "https://api.openverse.org/v1/images/";
const TOKEN_ENDPOINT = "https://api.openverse.org/v1/auth_tokens/token/";
const TIMEOUT_MS = 8000;
const FUENTE = "openverse";

let tokenCache = null; // { valor, expiraEn } — vive mientras la instancia de la Function esté "warm"

function estaConfigurado() {
    return true; // funciona anónimo
}

function licenciaPermiteUsoComercialYDerivados(licenciaSlug) {
    if (!licenciaSlug) { return false; } // §37: si no se puede determinar, no autoaprobar
    const slug = String(licenciaSlug).toLowerCase();
    if (slug.indexOf("nc") !== -1) { return false; }
    if (slug.indexOf("nd") !== -1) { return false; }
    return ["cc0", "pdm", "by", "by-sa", "publicdomain"].some((permitida) => slug.indexOf(permitida) !== -1);
}

async function obtenerTokenOpcional() {
    const clientId = process.env.OPENVERSE_CLIENT_ID;
    const clientSecret = process.env.OPENVERSE_CLIENT_SECRET;
    if (!clientId || !clientSecret) { return null; }

    if (tokenCache && tokenCache.expiraEn > Date.now()) {
        return tokenCache.valor;
    }

    try {
        const respuesta = await fetch(TOKEN_ENDPOINT, {
            method: "POST",
            headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": USER_AGENT },
            body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: "client_credentials" }).toString()
        });
        if (!respuesta.ok) { return null; }
        const datos = await respuesta.json();
        if (!datos.access_token) { return null; }
        tokenCache = { valor: datos.access_token, expiraEn: Date.now() + ((datos.expires_in || 3600) - 60) * 1000 };
        return tokenCache.valor;
    } catch (error) {
        return null; // las credenciales opcionales nunca deben romper la búsqueda anónima
    }
}

async function buscar(query, opciones) {
    const limite = (opciones && opciones.limite) || 6;

    const parametros = new URLSearchParams({
        q: query,
        license_type: "commercial",
        page_size: String(limite)
    });

    const encabezados = { "user-agent": USER_AGENT };
    const token = await obtenerTokenOpcional();
    if (token) { encabezados.authorization = "Bearer " + token; }

    const controlador = new AbortController();
    const idTimeout = setTimeout(() => controlador.abort(), TIMEOUT_MS);

    let respuesta;
    try {
        respuesta = await fetch(ENDPOINT + "?" + parametros.toString(), {
            signal: controlador.signal,
            headers: encabezados
        });
    } catch (error) {
        throw new Error(error.name === "AbortError" ? "Tiempo de espera agotado consultando Openverse." : "Error de red al consultar Openverse: " + error.message);
    } finally {
        clearTimeout(idTimeout);
    }

    if (respuesta.status === 429) {
        const retryAfterHeader = Number(respuesta.headers.get("retry-after"));
        const error = new Error("Openverse respondió 429 (rate limit).");
        error.retryAfterMs = isNaN(retryAfterHeader) ? null : retryAfterHeader * 1000;
        throw error;
    }

    if (!respuesta.ok) {
        throw new Error("Openverse respondió " + respuesta.status + ".");
    }

    const datos = await respuesta.json();
    const FILETYPES_PERMITIDOS = ["jpg", "jpeg", "png", "webp"];

    return (datos.results || [])
        .filter((resultado) => licenciaPermiteUsoComercialYDerivados(resultado.license))
        // Igual que con Wikimedia: si Openverse devuelve un formato que
        // nuestro pipeline de descarga no acepta (svg, gif, tiff...), ni se
        // ofrece como candidato — fallaría seguro al intentar importarlo.
        // Cuando `filetype` no viene informado, se deja pasar (se valida
        // igual por Content-Type/magic-bytes al momento de descargar).
        .filter((resultado) => !resultado.filetype || FILETYPES_PERMITIDOS.indexOf(String(resultado.filetype).toLowerCase()) !== -1)
        .map((resultado) => ({
            url: resultado.url,
            thumbnail: resultado.thumbnail || null,
            width: resultado.width || null,
            height: resultado.height || null,
            title: resultado.title || "",
            sourceUrl: resultado.foreign_landing_url || null,
            sourceDomain: resultado.source || resultado.provider || "openverse.org",
            fuente: FUENTE,
            license: resultado.license,
            licenseVersion: resultado.license_version || null,
            licenseUrl: resultado.license_url || null,
            author: resultado.creator || null,
            authorUrl: resultado.creator_url || null,
            attribution: resultado.attribution || null
        }));
}

module.exports = { buscar, estaConfigurado, licenciaPermiteUsoComercialYDerivados, FUENTE };
