# Aplicar la Fase 2 al proyecto Supabase real

Pegá **todo** el bloque de abajo en el SQL Editor del proyecto real
(`https://supabase.com/dashboard/project/babglruyhltjncvaryvz/sql/new`) y
dale **Run**. Es idempotente (`drop policy if exists` antes de cada
`create policy`, `on conflict` en los buckets), así que si algo falla a
mitad de camino podés corregir y volver a correrlo entero.

```sql
-- ============================================================
-- 1) Auth + RLS de escritura (supabase/migrations/20260731020624_admin_auth_and_write_rls.sql)
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create table public.perfiles (
    id uuid primary key references auth.users(id) on delete cascade,
    nombre text,
    rol text not null default 'usuario' check (rol in ('admin', 'usuario')),
    estado boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

drop trigger if exists perfiles_set_updated_at on public.perfiles;
create trigger perfiles_set_updated_at
    before update on public.perfiles
    for each row execute function public.set_updated_at();

create or replace function public.es_admin()
returns boolean
language sql
security invoker
stable
as $$
    select exists (
        select 1 from public.perfiles
        where id = auth.uid() and rol = 'admin' and estado = true
    );
$$;

grant execute on function public.es_admin() to authenticated;

alter table public.perfiles enable row level security;
grant usage on schema public to authenticated;
grant select on public.perfiles to authenticated;

drop policy if exists "perfiles_select_own" on public.perfiles;
create policy "perfiles_select_own"
    on public.perfiles for select to authenticated
    using (id = auth.uid());

grant insert, update on public.categorias to authenticated;
grant insert, update on public.productos to authenticated;

drop policy if exists "categorias_admin_select" on public.categorias;
create policy "categorias_admin_select"
    on public.categorias for select to authenticated
    using (es_admin());

drop policy if exists "categorias_admin_insert" on public.categorias;
create policy "categorias_admin_insert"
    on public.categorias for insert to authenticated
    with check (es_admin());

drop policy if exists "categorias_admin_update" on public.categorias;
create policy "categorias_admin_update"
    on public.categorias for update to authenticated
    using (es_admin()) with check (es_admin());

drop policy if exists "productos_admin_select" on public.productos;
create policy "productos_admin_select"
    on public.productos for select to authenticated
    using (es_admin());

drop policy if exists "productos_admin_insert" on public.productos;
create policy "productos_admin_insert"
    on public.productos for insert to authenticated
    with check (es_admin());

drop policy if exists "productos_admin_update" on public.productos;
create policy "productos_admin_update"
    on public.productos for update to authenticated
    using (es_admin()) with check (es_admin());

-- ============================================================
-- 2) Storage (supabase/migrations/20260731021519_storage_buckets_and_policies.sql)
-- ============================================================

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
```

## Verificación rápida (en el mismo SQL Editor)

```sql
select count(*) from public.perfiles;                     -- 0 por ahora, normal
select id, name, public from storage.buckets;              -- productos, categorias
select tablename, policyname, cmd from pg_policies
    where schemaname in ('public','storage') order by 1,3;
```

## Siguiente paso

Una vez corrido esto, seguí `supabase/PRIMER_ADMIN.md` para crear tu primer
administrador real (crear el usuario en Authentication → Users, copiar su
uuid, insertarlo en `perfiles` con `rol='admin'`).
