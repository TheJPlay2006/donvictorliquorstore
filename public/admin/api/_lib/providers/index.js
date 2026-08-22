// Registro de proveedores de ImageSearchProvider. Cambiar de proveedor es
// agregar un archivo con la misma interfaz (buscar/estaConfigurado) y
// registrarlo acá + IMAGE_SEARCH_PROVIDER=<nombre>. Nada más del código
// (scoring, cache, endpoints) depende del proveedor concreto.
"use strict";

const exa = require("./exa");

const PROVEEDORES = { exa: exa };

function nombreProveedorActivo() {
    return String(process.env.IMAGE_SEARCH_PROVIDER || "exa").toLowerCase();
}

function proveedorActivo() {
    return PROVEEDORES[nombreProveedorActivo()] || null;
}

function busquedaAutomaticaHabilitada() {
    if (String(process.env.IMAGE_SEARCH_ENABLED || "").toLowerCase() !== "true") {
        return false;
    }
    const proveedor = proveedorActivo();
    return !!(proveedor && proveedor.estaConfigurado());
}

module.exports = { proveedorActivo, nombreProveedorActivo, busquedaAutomaticaHabilitada };
