// Orquesta cache + proveedor + scoring para un producto: esta es la pieza
// central que usa api/image-search/resolve.js por cada fila.
"use strict";

const providers = require("./providers");
const cache = require("./cache");
const { evaluarCandidatos } = require("./scoring");
const { construirConsulta, construirClaveCache } = require("./consulta");
const { conReintentos } = require("./concurrencia");

const MAX_CANDIDATOS_DEVUELTOS = 5;

// producto: { nombre, marca, presentacion, codigo, barcode }
// Devuelve: { estado: 'encontrada'|'revisar'|'sin_resultado'|'error_temporal'|'error_proveedor',
//             confianza, candidatos: [{url, sourceUrl, sourceDomain, title, score, confianza}],
//             ganador (candidato con mayor score, o null), searchQuery, cacheKey, deCache }
async function resolverImagenProducto(clienteSupabase, producto, opciones) {
    const forzar = !!(opciones && opciones.forzar);
    const consultaPersonalizada = opciones && opciones.consultaPersonalizada;
    // `opciones.proveedor` permite inyectar un proveedor falso en los tests
    // (ver resolver.test.js) sin tocar el comportamiento en producción, donde
    // siempre se usa el proveedor activo real.
    const proveedor = (opciones && opciones.proveedor) || providers.proveedorActivo();

    if (!proveedor || !proveedor.estaConfigurado()) {
        return { estado: "error_proveedor", candidatos: [], ganador: null, searchQuery: null, mensaje: "Proveedor de búsqueda no configurado." };
    }

    const query = consultaPersonalizada || construirConsulta(producto);
    const claveCache = consultaPersonalizada ? null : construirClaveCache(producto);

    let candidatosCrudos = null;

    if (!forzar && claveCache) {
        candidatosCrudos = await cache.obtenerDeCache(clienteSupabase, claveCache);
    }

    let deCache = candidatosCrudos !== null;

    if (candidatosCrudos === null) {
        try {
            candidatosCrudos = await conReintentos(
                () => proveedor.buscar(query, { limite: 6 }),
                {
                    maxIntentos: 2,
                    esperaBaseMs: 1500,
                    esperaMaximaMs: 8000,
                    esReintentable: (error) => {
                        // Marcador de "rate limit" sin acoplarse a la clase
                        // concreta del proveedor: cualquier error con la
                        // propiedad `retryAfterMs` (aunque sea null) se
                        // considera temporal/reintentable, igual que un 5xx.
                        const esRateLimit = !!error && Object.prototype.hasOwnProperty.call(error, "retryAfterMs");
                        const esErrorServidor = !!error && /respondió 5\d\d/.test(error.message || "");
                        return esRateLimit || esErrorServidor;
                    }
                }
            );
        } catch (error) {
            if (proveedor.ErrorProveedorSinCredito && error instanceof proveedor.ErrorProveedorSinCredito) {
                return { estado: "error_proveedor", candidatos: [], ganador: null, searchQuery: query, mensaje: "El proveedor de búsqueda alcanzó su límite de crédito." };
            }
            return { estado: "error_temporal", candidatos: [], ganador: null, searchQuery: query, mensaje: error.message || "Error buscando la imagen." };
        }

        if (claveCache) {
            await cache.guardarEnCache(clienteSupabase, claveCache, providers.nombreProveedorActivo(), query, candidatosCrudos);
        }
    }

    const evaluados = evaluarCandidatos(candidatosCrudos || [], producto).slice(0, MAX_CANDIDATOS_DEVUELTOS);
    const ganador = evaluados.length > 0 ? evaluados[0] : null;

    if (!ganador || ganador.confianza === "baja") {
        return { estado: "sin_resultado", confianza: ganador ? ganador.confianza : null, candidatos: evaluados, ganador: null, searchQuery: query, cacheKey: claveCache, deCache: deCache };
    }

    return {
        estado: ganador.confianza === "alta" ? "encontrada" : "revisar",
        confianza: ganador.confianza,
        candidatos: evaluados,
        ganador: ganador,
        searchQuery: query,
        cacheKey: claveCache,
        deCache: deCache
    };
}

module.exports = { resolverImagenProducto };
