// GET /api/image-search/status — expone únicamente flags no sensibles (nunca
// ninguna API key) para que el frontend sepa si puede ofrecer "buscar
// imágenes automáticamente", con qué proveedores y con qué límites. Sin
// autenticación: no revela nada que no debiera verse (nada de esto es secreto).
"use strict";

const providers = require("../_lib/providers");

module.exports = function handler(req, res) {
    if (req.method !== "GET") {
        res.status(405).json({ error: "Método no permitido." });
        return;
    }

    const concurrenciaCruda = Number(process.env.IMAGE_SEARCH_CONCURRENCY);
    const maximoCrudo = Number(process.env.IMAGE_SEARCH_MAX_PER_IMPORT);
    const proveedoresGratuitos = providers.proveedoresGratuitosActivos();

    res.status(200).json({
        enabled: providers.busquedaAutomaticaHabilitada(),
        providers: proveedoresGratuitos,
        paidProviderActive: providers.exaActivo(),
        deepSearchExpandedAvailable: providers.busquedaProfundaAmpliadaDisponible(),
        mode: providers.modoBusqueda(),
        maxPerImport: Number.isFinite(maximoCrudo) && maximoCrudo > 0 ? maximoCrudo : 300,
        concurrency: Math.max(1, Math.min(Number.isFinite(concurrenciaCruda) ? concurrenciaCruda : 3, 8))
    });
};
