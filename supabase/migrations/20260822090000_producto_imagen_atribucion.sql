-- Metadata de licencia/atribución para imágenes encontradas por búsqueda
-- automática en fuentes abiertas (Open Food Facts, Wikimedia Commons,
-- Openverse). Se guarda separada de `productos` para no contaminar ese
-- modelo con datos que la mayoría de los productos (imagen subida a mano o
-- por ZIP) no necesita — solo existe una fila cuando corresponde.
-- Admin-only, mismo criterio que el resto del esquema.

create table public.producto_imagen_atribucion (
    id_producto integer primary key
        references public.productos(id_producto) on delete cascade,
    fuente text not null,
    fuente_url text,
    licencia text,
    licencia_url text,
    autor text,
    actualizado_en timestamptz not null default now()
);

alter table public.producto_imagen_atribucion enable row level security;

grant select, insert, update on public.producto_imagen_atribucion to authenticated;

drop policy if exists "producto_imagen_atribucion_admin_select" on public.producto_imagen_atribucion;
create policy "producto_imagen_atribucion_admin_select"
    on public.producto_imagen_atribucion for select to authenticated
    using (es_admin());

drop policy if exists "producto_imagen_atribucion_admin_insert" on public.producto_imagen_atribucion;
create policy "producto_imagen_atribucion_admin_insert"
    on public.producto_imagen_atribucion for insert to authenticated
    with check (es_admin());

drop policy if exists "producto_imagen_atribucion_admin_update" on public.producto_imagen_atribucion;
create policy "producto_imagen_atribucion_admin_update"
    on public.producto_imagen_atribucion for update to authenticated
    using (es_admin()) with check (es_admin());
