// Cache persistente de resultados de búsqueda (tabla
// public.busqueda_imagen_cache, ver migración
// 20260822000000_busqueda_imagen_cache.sql). Evita repetir la misma búsqueda
// entre importaciones distintas: mismo código/barcode o misma consulta
// normalizada → mismos candidatos, sin volver a llamar al proveedor.
"use strict";

async function obtenerDeCache(clienteSupabase, clave) {
    const { data, error } = await clienteSupabase
        .from("busqueda_imagen_cache")
        .select("candidatos")
        .eq("clave", clave)
        .maybeSingle();

    if (error || !data) {
        return null;
    }

    return data.candidatos;
}

async function guardarEnCache(clienteSupabase, clave, proveedor, consulta, candidatos) {
    await clienteSupabase
        .from("busqueda_imagen_cache")
        .upsert({ clave: clave, proveedor: proveedor, consulta: consulta, candidatos: candidatos }, { onConflict: "clave" })
        .then(() => {}, () => {
            // El cache es una optimización, no una garantía: si falla el
            // guardado (p. ej. una condición de carrera de upsert), la
            // búsqueda igual se resolvió bien para esta fila.
        });
}

module.exports = { obtenerDeCache, guardarEnCache };
