-- Fase 2: tabla de perfiles/roles, función es_admin(), y políticas de
-- escritura para administradores sobre categorias/productos. Se agregan EN
-- CAPAS sobre las políticas de solo-lectura pública de la Fase 1 (RLS
-- combina políticas del mismo comando con OR, no las reemplaza).

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

-- security invoker (no definer): perfiles_select_own ya deja que cada
-- usuario lea su propia fila sin depender de es_admin(), así que no hay
-- recursión ni necesidad de elevar privilegios.
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
-- Sin grant de insert/update/delete a authenticated: nadie puede escribir
-- perfiles desde el cliente, ni siquiera su propia fila. Así se garantiza
-- que un usuario nunca pueda auto-asignarse rol='admin'.

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

-- Sin políticas de delete en ningún lado: borrado lógico (estado=false) únicamente.
