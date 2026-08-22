// POST /api/image-search/import-image — descarga una imagen externa (la
// ganadora de una búsqueda automática, o la elegida a mano desde "Cambiar"),
// la procesa con el mismo pipeline que una imagen subida a mano
// (redimensionar + WebP) y la sube al mismo bucket de Storage. Requiere
// admin autenticado. Nunca guarda la URL externa tal cual — ver §14 del
// pedido: siempre queda una copia propia en nuestro Storage.
"use strict";

const { requerirAdmin, HttpError } = require("../_lib/supabaseServer");
const { descargarImagenSegura, ErrorDescargaImagen } = require("../_lib/ssrfFetch");
const { subirImagenAdmin } = require("../_lib/imagenPipeline");

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

    const body = req.body || {};
    const url = String(body.url || "").trim();
    const nombreBase = String(body.nombreBase || "producto").trim();

    if (!url) {
        res.status(400).json({ error: "Falta la URL de la imagen." });
        return;
    }

    try {
        const { buffer } = await descargarImagenSegura(url);
        const resultado = await subirImagenAdmin(sesion.cliente, "productos", buffer, nombreBase);
        res.status(200).json({ url: resultado.url });
    } catch (error) {
        const esErrorConocido = error instanceof ErrorDescargaImagen;
        console.error("[IMAGE_SEARCH_IMPORT] fallo al descargar/procesar imagen:", error.message);
        res.status(esErrorConocido ? 422 : 500).json({ error: error.message || "No se pudo procesar la imagen." });
    }
};
