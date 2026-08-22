// GET /api/image-search/status — expone únicamente flags no sensibles (nunca
// la API key) para que el frontend sepa si puede ofrecer "buscar imágenes
// automáticamente" y con qué límites. Sin autenticación: no revela nada que
// no debiera verse (nada de esto es secreto).
"use strict";

const providers = require("../_lib/providers");

module.exports = function handler(req, res) {
    if (req.method !== "GET") {
        res.status(405).json({ error: "Método no permitido." });
        return;
    }

    const concurrenciaCruda = Number(process.env.IMAGE_SEARCH_CONCURRENCY);
    const maximoCrudo = Number(process.env.IMAGE_SEARCH_MAX_PER_IMPORT);

    res.status(200).json({
        enabled: providers.busquedaAutomaticaHabilitada(),
        provider: providers.nombreProveedorActivo(),
        maxPerImport: Number.isFinite(maximoCrudo) && maximoCrudo > 0 ? maximoCrudo : 300,
        concurrency: Math.max(1, Math.min(Number.isFinite(concurrenciaCruda) ? concurrenciaCruda : 4, 8))
    });
};
