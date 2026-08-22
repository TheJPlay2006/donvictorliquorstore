// ProductImageResolver: orquesta la cadena de proveedores gratuitos +
// scoring + cache para un producto. Esta es la pieza central que usa
// api/image-search/resolve.js por cada fila.
//
// Prioridad (§4 del pedido):
//   1) barcode/GTIN válido -> Open Food Facts (por barcode)
//   2) marca+nombre+presentación -> Wikimedia Commons (hasta 3 variantes)
//   3) marca+nombre+presentación -> Openverse (mismas variantes)
//   4) (opcional, solo si hay EXA_API_KEY) Exa Search API como último recurso
//   5) sin imagen / revisión manual
// Se detiene apenas hay un candidato de confianza "alta" — no sigue
// gastando llamadas a proveedores externos una vez que ya encontró algo bueno.
"use strict";

const cache = require("./cache");
const { evaluarCandidatos } = require("./scoring");
const { construirConsulta, construirClaveCache } = require("./consulta");
const { generarVariantesConsulta } = require("./texto");
const { validarBarcode } = require("./barcode");
const { conReintentos } = require("./concurrencia");

const openfoodfacts = require("./providers/openfoodfacts");
const wikimedia = require("./providers/wikimedia");
const openverse = require("./providers/openverse");
const exa = require("./providers/exa");

const MAX_CANDIDATOS_DEVUELTOS = 5;
const MAX_FALLOS_CONSECUTIVOS = 5; // circuit breaker simple, §43

function proveedorHabilitadoPorEnv(nombreEnvVar) {
    const valor = process.env[nombreEnvVar];
    return valor === undefined || String(valor).toLowerCase() !== "false"; // default: habilitado
}

// Registro de proveedores gratuitos + orden de la cadena. `tipo: "barcode"`
// se consulta una sola vez con el barcode; `tipo: "texto"` se consulta con
// cada variante de consulta hasta encontrar confianza alta.
function construirCadenaProveedores(overrides) {
    return [
        { nombre: "openfoodfacts", tipo: "barcode", envVar: "IMAGE_SEARCH_OPENFOODFACTS_ENABLED", modulo: (overrides && overrides.openfoodfacts) || openfoodfacts },
        { nombre: "wikimedia", tipo: "texto", envVar: "IMAGE_SEARCH_WIKIMEDIA_ENABLED", modulo: (overrides && overrides.wikimedia) || wikimedia },
        { nombre: "openverse", tipo: "texto", envVar: "IMAGE_SEARCH_OPENVERSE_ENABLED", modulo: (overrides && overrides.openverse) || openverse },
        // Exa es de pago y opcional: solo entra a la cadena si hay API key
        // configurada, y siempre al final (fallback extra, nunca reemplaza
        // a los proveedores gratuitos).
        { nombre: "exa", tipo: "texto", envVar: "IMAGE_SEARCH_EXA_ENABLED", modulo: (overrides && overrides.exa) || exa, requiereConfiguracion: true }
    ];
}

function circuitoAbierto(estadoCircuito, nombre) {
    return (estadoCircuito[nombre] || 0) >= MAX_FALLOS_CONSECUTIVOS;
}

function registrarResultadoCircuito(estadoCircuito, nombre, exito) {
    estadoCircuito[nombre] = exito ? 0 : (estadoCircuito[nombre] || 0) + 1;
}

function log(mensaje) {
    console.log("[IMAGE_SEARCH] " + mensaje);
}

function mejorCandidato(candidatosCrudos, producto) {
    if (!candidatosCrudos.length) { return null; }
    return evaluarCandidatos(candidatosCrudos, producto)[0];
}

// producto: { nombre, marca, presentacion, codigo, barcode }
async function resolverImagenProducto(clienteSupabase, producto, opciones) {
    const forzar = !!(opciones && opciones.forzar);
    const consultaPersonalizada = opciones && opciones.consultaPersonalizada;
    const estadoCircuito = (opciones && opciones.estadoCircuito) || {};
    const identificador = producto.codigo || producto.nombre || "?";

    const cadena = construirCadenaProveedores(opciones && opciones.proveedores);

    const claveCache = consultaPersonalizada ? null : construirClaveCache(producto);
    let candidatosCrudos = null;

    if (!forzar && claveCache) {
        candidatosCrudos = await cache.obtenerDeCache(clienteSupabase, claveCache);
    }
    const deCache = candidatosCrudos !== null;

    if (candidatosCrudos === null) {
        candidatosCrudos = [];

        const barcode = consultaPersonalizada ? null : validarBarcode(producto.barcode);
        const variantes = consultaPersonalizada ? [consultaPersonalizada] : generarVariantesConsulta(producto);

        for (let i = 0; i < cadena.length; i++) {
            const proveedor = cadena[i];

            const yaHayAlta = mejorCandidato(candidatosCrudos, producto);
            if (yaHayAlta && yaHayAlta.confianza === "alta") { break; }

            if (!proveedorHabilitadoPorEnv(proveedor.envVar)) { continue; }
            if (proveedor.requiereConfiguracion && !proveedor.modulo.estaConfigurado()) { continue; }
            if (circuitoAbierto(estadoCircuito, proveedor.nombre)) {
                log("product=" + identificador + " provider=" + proveedor.nombre + " skip=circuit_open");
                continue;
            }

            try {
                if (proveedor.tipo === "barcode") {
                    if (!barcode) { continue; }
                    log("product=" + identificador + " provider=" + proveedor.nombre + " barcode=" + barcode);
                    const resultado = await conReintentos(() => proveedor.modulo.buscarPorBarcode(barcode), opcionesReintento());
                    candidatosCrudos.push(...resultado);
                    registrarResultadoCircuito(estadoCircuito, proveedor.nombre, true);
                    log("product=" + identificador + " provider=" + proveedor.nombre + " result=" + (resultado.length ? "found" : "not_found"));
                } else {
                    for (let v = 0; v < variantes.length; v++) {
                        const yaAlta = mejorCandidato(candidatosCrudos, producto);
                        if (yaAlta && yaAlta.confianza === "alta") { break; }

                        const query = proveedor.nombre === "exa" ? construirConsulta(producto) : variantes[v];
                        const resultado = await conReintentos(() => proveedor.modulo.buscar(query, { limite: 6 }), opcionesReintento());
                        candidatosCrudos.push(...resultado);
                        log("product=" + identificador + " provider=" + proveedor.nombre + " candidates=" + resultado.length);

                        if (proveedor.nombre === "exa") { break; } // Exa arma su propia consulta compuesta, no itera variantes
                    }
                    registrarResultadoCircuito(estadoCircuito, proveedor.nombre, true);
                }
            } catch (error) {
                registrarResultadoCircuito(estadoCircuito, proveedor.nombre, false);
                log("product=" + identificador + " provider=" + proveedor.nombre + " error=" + (error.message || "desconocido"));
                // Una fuente externa que falla nunca bloquea el import (§41/§42):
                // se sigue con el siguiente proveedor de la cadena.
            }
        }

        if (claveCache) {
            await cache.guardarEnCache(clienteSupabase, claveCache, "chain", variantes[0] || "", candidatosCrudos);
        }
    }

    const evaluados = evaluarCandidatos(candidatosCrudos || [], producto).slice(0, MAX_CANDIDATOS_DEVUELTOS);
    const ganador = evaluados.length > 0 ? evaluados[0] : null;

    if (ganador) {
        log("product=" + identificador + " selected score=" + ganador.score + " fuente=" + ganador.fuente + " confianza=" + ganador.confianza);
    } else {
        log("product=" + identificador + " selected=none");
    }

    const searchQueryMostrado = consultaPersonalizada || construirConsulta(producto);

    if (!ganador || ganador.confianza === "baja") {
        return { estado: "sin_resultado", confianza: ganador ? ganador.confianza : null, candidatos: evaluados, ganador: null, searchQuery: searchQueryMostrado, cacheKey: claveCache, deCache: deCache };
    }

    return {
        estado: ganador.confianza === "alta" ? "encontrada" : "revisar",
        confianza: ganador.confianza,
        candidatos: evaluados,
        ganador: ganador,
        searchQuery: searchQueryMostrado,
        cacheKey: claveCache,
        deCache: deCache
    };
}

function opcionesReintento() {
    return {
        maxIntentos: 2,
        esperaBaseMs: 1500,
        esperaMaximaMs: 8000,
        esReintentable: (error) => {
            const esRateLimit = !!error && Object.prototype.hasOwnProperty.call(error, "retryAfterMs");
            const esErrorServidor = !!error && /respondió 5\d\d/.test(error.message || "");
            return esRateLimit || esErrorServidor;
        }
    };
}

module.exports = { resolverImagenProducto, construirCadenaProveedores };
