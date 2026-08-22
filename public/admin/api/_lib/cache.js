// Cache persistente de resultados de búsqueda (tabla
// public.busqueda_imagen_cache, ver migración
// 20260822000000_busqueda_imagen_cache.sql). Evita repetir la misma búsqueda
// entre importaciones distintas: mismo código/barcode o misma consulta
// normalizada → mismos candidatos, sin volver a llamar al proveedor.
"use strict";

function diasDeCache() {
    const crudo = Number(process.env.IMAGE_SEARCH_CACHE_DAYS);
    return Number.isFinite(crudo) && crudo > 0 ? crudo : 30;
}

async function obtenerDeCache(clienteSupabase, clave) {
    const limiteFecha = new Date(Date.now() - diasDeCache() * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await clienteSupabase
        .from("busqueda_imagen_cache")
        .select("candidatos, creado_en")
        .eq("clave", clave)
        .gt("creado_en", limiteFecha)
        .maybeSingle();

    if (error || !data) {
        return null; // no encontrado, o encontrado pero vencido (fuera del período de cache)
    }

    return data.candidatos;
}

async function guardarEnCache(clienteSupabase, clave, proveedor, consulta, candidatos) {
    // `creado_en` se fija explícitamente acá (no alcanza con el DEFAULT de la
    // columna): en un upsert que actualiza una fila existente, el DEFAULT
    // solo aplica en el INSERT original, no en el UPDATE del conflicto — sin
    // esto, una fila vencida nunca "refresca" su fecha y quedaría vista como
    // vencida para siempre.
    await clienteSupabase
        .from("busqueda_imagen_cache")
        .upsert({ clave: clave, proveedor: proveedor, consulta: consulta, candidatos: candidatos, creado_en: new Date().toISOString() }, { onConflict: "clave" })
        .then(() => {}, () => {
            // El cache es una optimización, no una garantía: si falla el
            // guardado (p. ej. una condición de carrera de upsert), la
            // búsqueda igual se resolvió bien para esta fila.
        });
}

module.exports = { obtenerDeCache, guardarEnCache };
