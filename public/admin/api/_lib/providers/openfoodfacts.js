// Adaptador para Open Food Facts (https://world.openfoodfacts.org) —
// gratuito, sin API key. Prioridad alta cuando el producto tiene un
// barcode/EAN/GTIN válido (ver api/_lib/barcode.js): un código de barras
// identifica el producto exacto mucho mejor que el texto.
//
// Contrato real verificado con peticiones en vivo (no asumido de la
// documentación, que no detalla el shape exacto de la respuesta):
//   GET https://world.openfoodfacts.org/api/v2/product/{barcode}.json
//       ?fields=code,product_name,brands,quantity,image_front_url,
//               image_url,selected_images,status
//   respuesta: { status: 1|0, status_verbose, product?: {...} }
// `image_front_url`/`selected_images.front.display.*` apuntan a la versión
// ".400.jpg" (400px); reemplazando el sufijo de tamaño por ".full.jpg" se
// obtiene la resolución original cuando existe (verificado en vivo) — se
// intenta esa primero y se cae al ".400" si el "full" no existe (404).
"use strict";

const USER_AGENT = require("../userAgent");

const ENDPOINT_BASE = "https://world.openfoodfacts.org/api/v2/product/";
const CAMPOS = "code,product_name,brands,quantity,image_front_url,image_url,selected_images,status";
const TIMEOUT_MS = 8000;
const FUENTE = "openfoodfacts";
const LICENCIA = "CC BY-SA 3.0";
const LICENCIA_URL = "https://creativecommons.org/licenses/by-sa/3.0/";

function estaConfigurado() {
    return true; // no requiere API key
}

function aUrlOriginal(urlDisplay) {
    // ".../front_en.879.400.jpg" -> ".../front_en.879.full.jpg"
    return urlDisplay.replace(/\.(\d+)\.(jpg|jpeg|png)$/i, ".full.$2");
}

async function existeUrl(url) {
    try {
        const controlador = new AbortController();
        const idTimeout = setTimeout(() => controlador.abort(), 4000);
        const respuesta = await fetch(url, { method: "HEAD", signal: controlador.signal, headers: { "user-agent": USER_AGENT } });
        clearTimeout(idTimeout);
        return respuesta.ok;
    } catch (error) {
        return false;
    }
}

async function buscarPorBarcode(barcode) {
    const controlador = new AbortController();
    const idTimeout = setTimeout(() => controlador.abort(), TIMEOUT_MS);

    let respuesta;
    try {
        respuesta = await fetch(ENDPOINT_BASE + encodeURIComponent(barcode) + ".json?fields=" + CAMPOS, {
            signal: controlador.signal,
            headers: { "user-agent": USER_AGENT }
        });
    } catch (error) {
        throw new Error(error.name === "AbortError" ? "Tiempo de espera agotado consultando Open Food Facts." : "Error de red al consultar Open Food Facts: " + error.message);
    } finally {
        clearTimeout(idTimeout);
    }

    if (respuesta.status === 429 || respuesta.status === 503) {
        const error = new Error("Open Food Facts respondió " + respuesta.status + ".");
        error.retryAfterMs = null;
        throw error;
    }

    if (!respuesta.ok) {
        throw new Error("Open Food Facts respondió " + respuesta.status + ".");
    }

    const datos = await respuesta.json();
    if (datos.status !== 1 || !datos.product) {
        return [];
    }

    const producto = datos.product;
    const urlDisplay = producto.image_front_url || producto.image_url || null;
    if (!urlDisplay) { return []; }

    const urlFull = aUrlOriginal(urlDisplay);
    const urlFinal = (urlFull !== urlDisplay && await existeUrl(urlFull)) ? urlFull : urlDisplay;

    return [{
        url: urlFinal,
        sourceUrl: "https://world.openfoodfacts.org/product/" + barcode,
        sourceDomain: "openfoodfacts.org",
        title: producto.product_name || "",
        fuente: FUENTE,
        offBrand: producto.brands || "",
        offQuantity: producto.quantity || "",
        license: LICENCIA,
        licenseUrl: LICENCIA_URL
    }];
}

module.exports = { buscarPorBarcode, estaConfigurado, FUENTE };
