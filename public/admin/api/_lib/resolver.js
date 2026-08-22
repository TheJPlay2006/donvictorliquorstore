// ProductImageResolver: orquesta proveedores + scoring + cache para un
// producto, en ETAPAS (§3/§9/§49) para no gastar requests de más:
//
//   FAST   (0-2 requests): barcode válido -> Open Food Facts + UPCitemdb lookup
//   NORMAL (2-4 requests): Wikimedia + Openverse, hasta 3 variantes de consulta
//   DEEP   (1-3 requests): solo si NORMAL no dio "alta" — variantes ampliadas
//          (alias ES/EN, hint regional), descubrimiento de barcode vía
//          UPCitemdb cuando no había uno, y Exa opcional si hay API key.
//
// Se detiene apenas hay un candidato de confianza "alta" — nunca seguimos
// gastando llamadas a proveedores externos una vez que ya encontramos algo
// bueno (§28 "search escalation" solo avanza de etapa si hace falta).
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
const upcitemdb = require("./providers/upcitemdb");
const exa = require("./providers/exa");

const MAX_CANDIDATOS_DEVUELTOS = 5;
const MAX_FALLOS_CONSECUTIVOS = 5; // circuit breaker simple, §43/§52

function proveedorHabilitadoPorEnv(nombreEnvVar) {
    const valor = process.env[nombreEnvVar];
    return valor === undefined || String(valor).toLowerCase() !== "false";
}

function modoProfundoPorDefecto() {
    return String(process.env.IMAGE_SEARCH_MODE || "deep").toLowerCase() === "deep";
}

function circuitoAbierto(estadoCircuito, nombre) {
    return (estadoCircuito[nombre] || 0) >= MAX_FALLOS_CONSECUTIVOS;
}

function registrarResultadoCircuito(estadoCircuito, nombre, exito) {
    estadoCircuito[nombre] = exito ? 0 : (estadoCircuito[nombre] || 0) + 1;
}

function log(producto, etapa, mensaje) {
    console.log("[IMAGE_SEARCH] product=" + producto + " stage=" + etapa + " " + mensaje);
}

function mejorCandidato(candidatosCrudos, producto) {
    if (!candidatosCrudos.length) { return null; }
    return evaluarCandidatos(candidatosCrudos, producto)[0];
}

function esAlta(candidato) {
    return !!candidato && candidato.confianza === "alta";
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

// Deduplica por URL normalizada (§23): mismo archivo indexado por dos
// proveedores distintos no debe aparecer dos veces en los candidatos.
function normalizarUrlParaDedup(url) {
    try {
        const u = new URL(url);
        u.search = "";
        u.hash = "";
        return (u.hostname + u.pathname).toLowerCase().replace(/\/$/, "");
    } catch (error) {
        return String(url || "").toLowerCase();
    }
}

function deduplicarCandidatos(candidatos) {
    const vistos = new Set();
    const resultado = [];
    candidatos.forEach((candidato) => {
        const clave = normalizarUrlParaDedup(candidato.url);
        if (vistos.has(clave)) { return; }
        vistos.add(clave);
        resultado.push(candidato);
    });
    return resultado;
}

async function intentarProveedor(producto, identificador, etapa, nombre, modulo, estadoCircuito, fn) {
    if (!proveedorHabilitadoPorEnv("IMAGE_SEARCH_" + nombre.toUpperCase() + "_ENABLED")) { return []; }
    if (typeof modulo.estaConfigurado === "function" && !modulo.estaConfigurado()) { return []; }
    if (circuitoAbierto(estadoCircuito, nombre)) {
        log(identificador, etapa, "provider=" + nombre + " skip=circuit_open");
        return [];
    }

    try {
        const resultado = await conReintentos(fn, opcionesReintento());
        registrarResultadoCircuito(estadoCircuito, nombre, true);
        log(identificador, etapa, "provider=" + nombre + " results=" + resultado.length);
        return resultado;
    } catch (error) {
        registrarResultadoCircuito(estadoCircuito, nombre, false);
        log(identificador, etapa, "provider=" + nombre + " error=" + (error.message || "desconocido"));
        return []; // una fuente que falla nunca bloquea el import (§41/§42)
    }
}

// producto: { nombre, marca, presentacion, codigo, barcode }
async function resolverImagenProducto(clienteSupabase, producto, opciones) {
    const forzar = !!(opciones && opciones.forzar);
    const consultaPersonalizada = opciones && opciones.consultaPersonalizada;
    const forzarProfundo = !!(opciones && opciones.profundo);
    const estadoCircuito = (opciones && opciones.estadoCircuito) || {};
    const proveedores = Object.assign({ openfoodfacts, wikimedia, openverse, upcitemdb, exa }, opciones && opciones.proveedores);
    const identificador = producto.codigo || producto.nombre || "?";

    const claveCache = consultaPersonalizada ? null : construirClaveCache(producto);
    let candidatosCrudos = null;

    if (!forzar && claveCache) {
        candidatosCrudos = await cache.obtenerDeCache(clienteSupabase, claveCache);
    }
    const deCache = candidatosCrudos !== null;

    if (candidatosCrudos === null) {
        candidatosCrudos = [];
        const barcode = consultaPersonalizada ? null : validarBarcode(producto.barcode);

        // ---------------- ETAPA FAST ----------------
        if (barcode) {
            const r1 = await intentarProveedor(producto, identificador, "fast", "openfoodfacts", proveedores.openfoodfacts, estadoCircuito,
                () => proveedores.openfoodfacts.buscarPorBarcode(barcode));
            candidatosCrudos.push(...r1);

            if (!esAlta(mejorCandidato(candidatosCrudos, producto))) {
                const r2 = await intentarProveedor(producto, identificador, "fast", "upcitemdb", proveedores.upcitemdb, estadoCircuito,
                    () => proveedores.upcitemdb.buscarPorBarcode(barcode));
                candidatosCrudos.push(...r2);
            }
        }

        // ---------------- ETAPA NORMAL ----------------
        if (!esAlta(mejorCandidato(candidatosCrudos, producto))) {
            const variantes = consultaPersonalizada ? [consultaPersonalizada] : generarVariantesConsulta(producto, { profundo: false });

            for (let v = 0; v < variantes.length && !esAlta(mejorCandidato(candidatosCrudos, producto)); v++) {
                const rw = await intentarProveedor(producto, identificador, "normal", "wikimedia", proveedores.wikimedia, estadoCircuito,
                    () => proveedores.wikimedia.buscar(variantes[v], { limite: 6 }));
                candidatosCrudos.push(...rw);
            }
            for (let v = 0; v < variantes.length && !esAlta(mejorCandidato(candidatosCrudos, producto)); v++) {
                const ro = await intentarProveedor(producto, identificador, "normal", "openverse", proveedores.openverse, estadoCircuito,
                    () => proveedores.openverse.buscar(variantes[v], { limite: 6 }));
                candidatosCrudos.push(...ro);
            }
        }

        // ---------------- ETAPA DEEP ----------------
        // Se activa si NORMAL no alcanzó "alta" Y el modo lo permite (o el
        // llamador pidió explícitamente "buscar más profundamente" en una
        // fila puntual, aunque el modo global sea "normal").
        const puedeProfundizar = !consultaPersonalizada && (forzarProfundo || modoProfundoPorDefecto());
        if (puedeProfundizar && !esAlta(mejorCandidato(candidatosCrudos, producto))) {
            // Descubrimiento de barcode cuando no había uno (§46): solo se
            // usa para buscar más imágenes en esta resolución, nunca se
            // guarda en el producto sin confirmación explícita.
            if (!barcode) {
                const queryDescubrimiento = construirConsulta(producto);
                try {
                    const barcodeDescubierto = proveedorHabilitadoPorEnv("IMAGE_SEARCH_UPCITEMDB_ENABLED") && !circuitoAbierto(estadoCircuito, "upcitemdb")
                        ? await conReintentos(() => proveedores.upcitemdb.descubrirBarcode(queryDescubrimiento, producto), opcionesReintento())
                        : null;
                    if (barcodeDescubierto) {
                        log(identificador, "deep", "upcitemdb descubrió posible barcode=" + barcodeDescubierto + " (sin guardar, solo para buscar imagen)");
                        const rOff = await intentarProveedor(producto, identificador, "deep", "openfoodfacts", proveedores.openfoodfacts, estadoCircuito,
                            () => proveedores.openfoodfacts.buscarPorBarcode(barcodeDescubierto));
                        candidatosCrudos.push(...rOff);
                    }
                } catch (error) {
                    log(identificador, "deep", "upcitemdb descubrimiento error=" + error.message);
                }
            }

            if (!esAlta(mejorCandidato(candidatosCrudos, producto))) {
                const rU = await intentarProveedor(producto, identificador, "deep", "upcitemdb", proveedores.upcitemdb, estadoCircuito,
                    () => proveedores.upcitemdb.buscar(construirConsulta(producto), { limite: 10 }));
                candidatosCrudos.push(...rU);
            }

            if (!esAlta(mejorCandidato(candidatosCrudos, producto))) {
                const variantesProfundas = generarVariantesConsulta(producto, { profundo: true });
                for (let v = 0; v < variantesProfundas.length && !esAlta(mejorCandidato(candidatosCrudos, producto)); v++) {
                    const rw = await intentarProveedor(producto, identificador, "deep", "wikimedia", proveedores.wikimedia, estadoCircuito,
                        () => proveedores.wikimedia.buscar(variantesProfundas[v], { limite: 6 }));
                    candidatosCrudos.push(...rw);
                }
                // Openverse también merece las variantes ampliadas: en NORMAL
                // solo se intentó con las 3 variantes cortas.
                for (let v = 0; v < variantesProfundas.length && !esAlta(mejorCandidato(candidatosCrudos, producto)); v++) {
                    const ro = await intentarProveedor(producto, identificador, "deep", "openverse", proveedores.openverse, estadoCircuito,
                        () => proveedores.openverse.buscar(variantesProfundas[v], { limite: 6 }));
                    candidatosCrudos.push(...ro);
                }
            }

            if (!esAlta(mejorCandidato(candidatosCrudos, producto)) && proveedores.exa.estaConfigurado()) {
                const rE = await intentarProveedor(producto, identificador, "deep", "exa", proveedores.exa, estadoCircuito,
                    () => proveedores.exa.buscar(construirConsulta(producto), { limite: 6 }));
                candidatosCrudos.push(...rE);
            }
        }

        candidatosCrudos = deduplicarCandidatos(candidatosCrudos);

        if (claveCache) {
            await cache.guardarEnCache(clienteSupabase, claveCache, "chain-v2", construirConsulta(producto), candidatosCrudos);
        }
    }

    const evaluados = evaluarCandidatos(candidatosCrudos || [], producto).slice(0, MAX_CANDIDATOS_DEVUELTOS);
    const ganador = evaluados.length > 0 ? evaluados[0] : null;

    if (ganador) {
        log(identificador, "final", "selected score=" + ganador.score + " identity=" + ganador.identityScore +
            " quality=" + ganador.qualityScore + " fuente=" + ganador.fuente + " confianza=" + ganador.confianza);
    } else {
        log(identificador, "final", "selected=none");
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

module.exports = { resolverImagenProducto, deduplicarCandidatos };
