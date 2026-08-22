// Cola con concurrencia limitada + reintentos acotados para llamar al
// proveedor de búsqueda. Nunca se lanzan N búsquedas en paralelo sin límite
// (§18), y un 429/error temporal no reintenta indefinidamente (§19).
"use strict";

function esperar(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// tarea(item) -> Promise<resultado>. Procesa `items` con como máximo
// `concurrencia` tareas simultáneas, invocando `alTerminar(item, resultado)`
// apenas cada una termina (para poder emitir progreso real, no simulado).
async function procesarConConcurrencia(items, concurrencia, tarea, alTerminar) {
    let indice = 0;

    async function trabajador() {
        while (indice < items.length) {
            const miIndice = indice++;
            const item = items[miIndice];
            let resultado;
            try {
                resultado = await tarea(item, miIndice);
            } catch (error) {
                resultado = { error: error };
            }
            if (alTerminar) {
                await alTerminar(item, resultado, miIndice);
            }
        }
    }

    const trabajadores = [];
    const limite = Math.max(1, Math.min(concurrencia || 1, items.length || 1));
    for (let i = 0; i < limite; i++) {
        trabajadores.push(trabajador());
    }
    await Promise.all(trabajadores);
}

// Reintenta `fn` hasta `maxIntentos` veces cuando lanza un error marcado como
// reintentable (`error.retryAfterMs` definido, o el propio llamador decide
// vía `esReintentable`). Nunca reintenta infinito.
async function conReintentos(fn, opciones) {
    const maxIntentos = (opciones && opciones.maxIntentos) || 2;
    const esReintentable = (opciones && opciones.esReintentable) || (() => false);
    const esperaBaseMs = (opciones && opciones.esperaBaseMs) || 1500;
    const esperaMaximaMs = (opciones && opciones.esperaMaximaMs) || 8000;

    let ultimoError;
    for (let intento = 0; intento <= maxIntentos; intento++) {
        try {
            return await fn();
        } catch (error) {
            ultimoError = error;
            if (intento === maxIntentos || !esReintentable(error)) {
                throw error;
            }
            const esperaSugerida = typeof error.retryAfterMs === "number" ? error.retryAfterMs : null;
            const espera = Math.min(esperaSugerida || esperaBaseMs * Math.pow(2, intento), esperaMaximaMs);
            await esperar(espera);
        }
    }
    throw ultimoError;
}

module.exports = { procesarConConcurrencia, conReintentos, esperar };
