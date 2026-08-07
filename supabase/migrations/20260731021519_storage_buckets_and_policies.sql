-- Buckets de Storage para imágenes de productos/categorías. Lectura pública
-- (igual que hoy con los archivos estáticos en public/img/), escritura solo
-- para admins (mismo es_admin() de la migración anterior).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
    ('productos', 'productos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
    ('categorias', 'categorias', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "storage_productos_categorias_public_read" on storage.objects;
create policy "storage_productos_categorias_public_read"
    on storage.objects for select
    to anon, authenticated
    using (bucket_id in ('productos', 'categorias'));

drop policy if exists "storage_productos_categorias_admin_insert" on storage.objects;
create policy "storage_productos_categorias_admin_insert"
    on storage.objects for insert
    to authenticated
    with check (bucket_id in ('productos', 'categorias') and es_admin());

drop policy if exists "storage_productos_categorias_admin_update" on storage.objects;
create policy "storage_productos_categorias_admin_update"
    on storage.objects for update
    to authenticated
    using (bucket_id in ('productos', 'categorias') and es_admin())
    with check (bucket_id in ('productos', 'categorias') and es_admin());

drop policy if exists "storage_productos_categorias_admin_delete" on storage.objects;
create policy "storage_productos_categorias_admin_delete"
    on storage.objects for delete
    to authenticated
    using (bucket_id in ('productos', 'categorias') and es_admin());
