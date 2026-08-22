// Estado global de la búsqueda automática de imágenes. Los proveedores
// gratuitos (Open Food Facts, Wikimedia, Openverse, UPCitemdb) no requieren
// ninguna key y están habilitados por defecto — por eso
// `busquedaAutomaticaHabilitada()` es `true` de fábrica, a menos que se
// apague explícitamente con IMAGE_SEARCH_ENABLED=false. Exa (de pago) y
// Brave (§7/§57, de pago, aún no implementado como provider) son extras
// opcionales: solo se suman a la cadena si además se configuró su API key.
"use strict";

const openfoodfacts = require("./openfoodfacts");
const wikimedia = require("./wikimedia");
const openverse = require("./openverse");
const upcitemdb = require("./upcitemdb");
const exa = require("./exa");
const ddgs = require("./ddgs");

function flagHabilitado(nombreEnvVar) {
    const valor = process.env[nombreEnvVar];
    return valor === undefined || String(valor).toLowerCase() !== "false";
}

function proveedoresGratuitosActivos() {
    const activos = [];
    if (flagHabilitado("IMAGE_SEARCH_OPENFOODFACTS_ENABLED") && openfoodfacts.estaConfigurado()) { activos.push("openfoodfacts"); }
    if (flagHabilitado("IMAGE_SEARCH_WIKIMEDIA_ENABLED") && wikimedia.estaConfigurado()) { activos.push("wikimedia"); }
    if (flagHabilitado("IMAGE_SEARCH_OPENVERSE_ENABLED") && openverse.estaConfigurado()) { activos.push("openverse"); }
    if (flagHabilitado("IMAGE_SEARCH_UPCITEMDB_ENABLED") && upcitemdb.estaConfigurado()) { activos.push("upcitemdb"); }
    return activos;
}

function exaActivo() {
    return flagHabilitado("IMAGE_SEARCH_EXA_ENABLED") && exa.estaConfigurado();
}

function ddgsActivo() {
    return flagHabilitado("IMAGE_SEARCH_DDGS_ENABLED") && ddgs.estaConfigurado();
}

// §57: "Búsqueda web profunda disponible" en la UI depende de si hay algún
// proveedor de búsqueda web configurado: Exa (de pago) o DDGS (gratuito).
// La etapa DEEP en sí (UPCitemdb, variantes ampliadas) ya corre siempre
// que el modo lo permita, con o sin proveedores de pago.
function busquedaProfundaAmpliadaDisponible() {
    return exaActivo() || ddgsActivo();
}

function modoBusqueda() {
    return String(process.env.IMAGE_SEARCH_MODE || "deep").toLowerCase() === "deep" ? "deep" : "normal";
}

function busquedaAutomaticaHabilitada() {
    if (!flagHabilitado("IMAGE_SEARCH_ENABLED")) { return false; }
    return proveedoresGratuitosActivos().length > 0 || exaActivo() || ddgsActivo();
}

module.exports = {
    proveedoresGratuitosActivos, exaActivo, ddgsActivo, busquedaAutomaticaHabilitada,
    busquedaProfundaAmpliadaDisponible, modoBusqueda
};
