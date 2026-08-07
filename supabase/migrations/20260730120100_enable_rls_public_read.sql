-- RLS de solo lectura pública. `mostrar_inicio`/`destacado`/`disponible` NO
-- se filtran aquí: siguen siendo filtros de consulta del cliente, igual que
-- lo eran en los modelos de Express. RLS solo decide si la fila es visible.

alter table public.categorias enable row level security;
alter table public.productos enable row level security;

-- PostgREST no da acceso automático a tablas creadas fuera del Table Editor.
grant usage on schema public to anon, authenticated;
grant select on public.categorias to anon, authenticated;
grant select on public.productos to anon, authenticated;

create policy "categorias_public_select"
    on public.categorias
    for select
    to anon, authenticated
    using (estado = true);

create policy "productos_public_select"
    on public.productos
    for select
    to anon, authenticated
    using (estado = true);

-- Sin políticas de insert/update/delete: denegado por defecto para anon y
-- authenticated. La escritura administrativa se habilita en una fase futura.
