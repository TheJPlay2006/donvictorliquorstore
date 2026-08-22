// POST /api/image-search/resolve — busca imágenes para un lote de productos.
// Requiere admin autenticado. Responde por Server-Sent Events: un evento por
// producto apenas se resuelve (progreso real, no simulado — ver §13 del
// pedido) y un evento final de resumen.
//
// Body: {
//   items: [{ indice, nombre, marca, presentacion, codigo, barcode }],
//   forzar: boolean,            // ignora cache (usado por "Buscar de nuevo")
//   consultaPersonalizada: string | null  // solo tiene sentido con un solo item
// }
"use strict";

const { requerirAdmin, HttpError } = require("../_lib/supabaseServer");
const { resolverImagenProducto } = require("../_lib/resolver");
const { procesarConConcurrencia } = require("../_lib/concurrencia");
const providers = require("../_lib/providers");

const MAX_ITEMS_POR_LLAMADA = 60;

function limitarConcurrencia() {
    const cruda = Number(process.env.IMAGE_SEARCH_CONCURRENCY);
    return Math.max(1, Math.min(Number.isFinite(cruda) ? cruda : 4, 8));
}

function limitePorImportacion() {
    const cruda = Number(process.env.IMAGE_SEARCH_MAX_PER_IMPORT);
    return Number.isFinite(cruda) && cruda > 0 ? cruda : 300;
}

module.exports = async function handler(req, res) {
    if (req.method !== "POST") {
        res.status(405).json({ error: "Método no permitido." });
        return;
    }

    let sesion;
    try {
        sesion = await requerirAdmin(req);
    } catch (error) {
        const status = error instanceof HttpError ? error.status : 500;
        res.status(status).json({ error: error.message || "Error de autenticación." });
        return;
    }

    if (!providers.busquedaAutomaticaHabilitada()) {
        res.status(409).json({ error: "La búsqueda automática de imágenes no está habilitada o configurada." });
        return;
    }

    const body = req.body || {};
    const items = Array.isArray(body.items) ? body.items : [];

    if (items.length === 0) {
        res.status(400).json({ error: "No se recibieron productos para buscar." });
        return;
    }
    if (items.length > MAX_ITEMS_POR_LLAMADA) {
        res.status(400).json({ error: "Máximo " + MAX_ITEMS_POR_LLAMADA + " productos por llamada; el frontend debe dividir en lotes." });
        return;
    }

    const limiteImport = limitePorImportacion();
    const itemsAProcesar = items.slice(0, limiteImport);
    const itemsOmitidos = items.slice(limiteImport);

    res.writeHead(200, {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "x-accel-buffering": "no"
    });

    function emitir(tipo, datos) {
        res.write("event: " + tipo + "\n" + "data: " + JSON.stringify(datos) + "\n\n");
    }

    itemsOmitidos.forEach((item) => {
        emitir("item", { indice: item.indice, estado: "omitido_limite" });
    });

    let procesados = 0;

    await procesarConConcurrencia(itemsAProcesar, limitarConcurrencia(), async (item) => {
        const resultado = await resolverImagenProducto(sesion.cliente, item, {
            forzar: !!body.forzar,
            consultaPersonalizada: items.length === 1 ? body.consultaPersonalizada : null
        });
        return resultado;
    }, (item, resultado) => {
        procesados++;
        const normalizado = resultado && resultado.error
            ? { estado: "error_temporal", candidatos: [], ganador: null, mensaje: resultado.error.message || "Error inesperado." }
            : resultado;
        emitir("item", Object.assign({ indice: item.indice }, normalizado));
        emitir("progreso", { procesados: procesados, total: itemsAProcesar.length });
    });

    emitir("done", { total: items.length, procesados: procesados, omitidos: itemsOmitidos.length });
    res.end();
};
