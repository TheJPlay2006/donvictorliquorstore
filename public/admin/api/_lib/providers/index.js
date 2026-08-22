// Estado global de la búsqueda automática de imágenes. Los proveedores
// gratuitos (Open Food Facts, Wikimedia, Openverse) no requieren ninguna
// key y están habilitados por defecto — por eso `busquedaAutomaticaHabilitada()`
// es `true` de fábrica, a menos que se apague explícitamente con
// IMAGE_SEARCH_ENABLED=false. Exa (de pago) es un extra opcional: solo se
// suma a la cadena si además se configuró su API key.
"use strict";

const openfoodfacts = require("./openfoodfacts");
const wikimedia = require("./wikimedia");
const openverse = require("./openverse");
const exa = require("./exa");

function flagHabilitado(nombreEnvVar) {
    const valor = process.env[nombreEnvVar];
    return valor === undefined || String(valor).toLowerCase() !== "false";
}

function proveedoresGratuitosActivos() {
    const activos = [];
    if (flagHabilitado("IMAGE_SEARCH_OPENFOODFACTS_ENABLED") && openfoodfacts.estaConfigurado()) { activos.push("openfoodfacts"); }
    if (flagHabilitado("IMAGE_SEARCH_WIKIMEDIA_ENABLED") && wikimedia.estaConfigurado()) { activos.push("wikimedia"); }
    if (flagHabilitado("IMAGE_SEARCH_OPENVERSE_ENABLED") && openverse.estaConfigurado()) { activos.push("openverse"); }
    return activos;
}

function exaActivo() {
    return flagHabilitado("IMAGE_SEARCH_EXA_ENABLED") && exa.estaConfigurado();
}

function busquedaAutomaticaHabilitada() {
    if (!flagHabilitado("IMAGE_SEARCH_ENABLED")) { return false; }
    return proveedoresGratuitosActivos().length > 0 || exaActivo();
}

module.exports = { proveedoresGratuitosActivos, exaActivo, busquedaAutomaticaHabilitada };
