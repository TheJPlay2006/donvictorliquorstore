// Construcción de la consulta de búsqueda y de la clave de cache a partir de
// los datos del producto. Lógica pura, sin red — ver
// api/_lib/consulta.test.js.
"use strict";

const crypto = require("node:crypto");

// Prioridad para construir el texto de búsqueda: barcode/EAN/GTIN (si existe,
// identifica el producto exacto mucho mejor que el texto) > marca + nombre +
// presentación. Términos genéricos ("bottle", "product", "750ml") se agregan
// solo cuando ayudan a evitar resultados de estilo de vida/promocionales, sin
// forzarlos si ya hay presentación explícita.
function construirConsulta(producto) {
    const barcode = String(producto.barcode || producto.gtin || "").trim();
    if (barcode) {
        return barcode + " product bottle";
    }

    const partes = [];
    if (producto.marca) { partes.push(String(producto.marca).trim()); }
    if (producto.nombre) { partes.push(String(producto.nombre).trim()); }
    if (producto.presentacion) { partes.push(String(producto.presentacion).trim()); }
    partes.push("bottle");

    return partes.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function normalizarParaClave(texto) {
    return String(texto || "")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .trim()
        .replace(/\s+/g, " ");
}

// Prefijo de versión del algoritmo (§42): al mejorar el scoring, subir
// IMAGE_SEARCH_ALGORITHM_VERSION invalida automáticamente todo el cache
// anterior (las claves quedan distintas), sin tener que vaciar la tabla ni
// arriesgarse a que resultados ya evaluados con reglas viejas (más laxas)
// sigan apareciendo como válidos.
function versionAlgoritmo() {
    return String(process.env.IMAGE_SEARCH_ALGORITHM_VERSION || "2").trim() || "2";
}

// Clave de cache: si hay barcode/código, ese identifica al producto de forma
// estable entre importaciones distintas (mismo producto → misma imagen, sin
// tener que volver a buscar). Si no, se cachea por el texto normalizado de la
// consulta.
function construirClaveCache(producto) {
    const v = "v" + versionAlgoritmo() + ":";
    const barcode = String(producto.barcode || producto.gtin || "").trim();
    if (barcode) {
        return v + "barcode:" + normalizarParaClave(barcode);
    }

    const codigo = String(producto.codigo || "").trim();
    if (codigo) {
        return v + "codigo:" + normalizarParaClave(codigo);
    }

    const consultaNormalizada = normalizarParaClave(construirConsulta(producto));
    const hash = crypto.createHash("sha256").update(consultaNormalizada).digest("hex").slice(0, 32);
    return v + "query:" + hash;
}

module.exports = { construirConsulta, construirClaveCache, normalizarParaClave };
