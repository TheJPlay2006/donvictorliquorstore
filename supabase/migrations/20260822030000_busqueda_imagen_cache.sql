-- Cache de resultados de búsqueda automática de imágenes de producto (ver
-- api/image-search/resolve.js). Clave: "barcode:<...>" / "codigo:<...>" /
-- "query:<hash>" — evita repetir la misma búsqueda entre importaciones.
-- Solo admins pueden leer/escribir (mismo criterio que categorias/productos).

create table public.busqueda_imagen_cache (
    clave text primary key,
    proveedor text not null,
    consulta text not null,
    candidatos jsonb not null default '[]'::jsonb,
    creado_en timestamptz not null default now()
);

alter table public.busqueda_imagen_cache enable row level security;

grant select, insert, update on public.busqueda_imagen_cache to authenticated;

drop policy if exists "busqueda_imagen_cache_admin_select" on public.busqueda_imagen_cache;
create policy "busqueda_imagen_cache_admin_select"
    on public.busqueda_imagen_cache for select to authenticated
    using (es_admin());

drop policy if exists "busqueda_imagen_cache_admin_insert" on public.busqueda_imagen_cache;
create policy "busqueda_imagen_cache_admin_insert"
    on public.busqueda_imagen_cache for insert to authenticated
    with check (es_admin());

drop policy if exists "busqueda_imagen_cache_admin_update" on public.busqueda_imagen_cache;
create policy "busqueda_imagen_cache_admin_update"
    on public.busqueda_imagen_cache for update to authenticated
    using (es_admin()) with check (es_admin());
