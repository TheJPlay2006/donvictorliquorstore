# Aplicar la Fase 1 al proyecto Supabase real

Pasos para llevar el schema + RLS + datos semilla (ya probados contra un stack
local) al proyecto real: `https://supabase.com/dashboard/project/babglruyhltjncvaryvz`.

1. Abrí el SQL Editor del proyecto: `https://supabase.com/dashboard/project/babglruyhltjncvaryvz/sql/new`
2. Pegá **todo** el bloque de abajo en una consulta nueva y dale **Run**. Es
   idempotente (`on conflict ... do nothing`), así que si algo falla a mitad
   de camino podés corregir y volver a correrlo entero sin duplicar datos.
3. Avisale a Claude cuando termine para verificar contra la API real.

```sql
-- ============================================================
-- 1) Schema (supabase/migrations/20260730120000_create_catalogo_schema.sql)
-- ============================================================

create table public.categorias (
    id_categoria integer generated always as identity primary key,
    nombre character varying(100) not null unique,
    descripcion text,
    imagen character varying(255),
    estado boolean not null default true,
    fecha_creacion timestamp without time zone default current_timestamp,
    mostrar_inicio boolean not null default false
);

create table public.productos (
    id_producto integer generated always as identity primary key,
    nombre character varying(150) not null,
    descripcion text,
    precio numeric(10,2) not null,
    stock integer not null default 0,
    imagen character varying(255),
    destacado boolean not null default false,
    estado boolean not null default true,
    fecha_creacion timestamp without time zone default current_timestamp,
    id_categoria integer not null
        references public.categorias(id_categoria)
        on update cascade on delete restrict,
    marca character varying(100),
    presentacion character varying(100),
    disponible boolean not null default true,
    promocion boolean not null default false,
    constraint productos_precio_check check (precio >= 0),
    constraint productos_stock_check check (stock >= 0)
);

-- ============================================================
-- 2) RLS (supabase/migrations/20260730120100_enable_rls_public_read.sql)
-- ============================================================

alter table public.categorias enable row level security;
alter table public.productos enable row level security;

grant usage on schema public to anon, authenticated;
grant select on public.categorias to anon, authenticated;
grant select on public.productos to anon, authenticated;

create policy "categorias_public_select"
    on public.categorias for select to anon, authenticated
    using (estado = true);

create policy "productos_public_select"
    on public.productos for select to anon, authenticated
    using (estado = true);

-- ============================================================
-- 3) Seed (supabase/seed.sql) — datos reales, verbatim del dump original
-- ============================================================

insert into public.categorias
    (id_categoria, nombre, descripcion, imagen, estado, fecha_creacion, mostrar_inicio)
overriding system value
values
    (1, 'Cervezas', 'Cervezas nacionales e importadas.', 'img/categorias/cervezas.jpg', true, timestamp '2026-07-19 19:49:10.658453', true),
    (2, 'Vinos y espumantes', 'Vinos tintos, blancos, rosados y espumantes.', 'img/categorias/vinos.jpg', true, timestamp '2026-07-19 19:49:10.658453', true),
    (3, 'Whisky y bourbon', 'Whiskys y bourbons nacionales e importados.', 'img/categorias/Whisky.jpg', true, timestamp '2026-07-19 19:49:10.658453', true),
    (4, 'Ron', 'Rones blancos, añejos y premium.', 'img/categorias/ron.jpg', true, timestamp '2026-07-19 19:49:10.658453', true),
    (5, 'Vodka', 'Vodkas nacionales e importados.', 'img/categorias/vodka.jpg', true, timestamp '2026-07-19 19:49:10.658453', true),
    (6, 'Tequila y mezcal', 'Tequilas y mezcales para todos los gustos.', 'img/categorias/tequila.jpg', true, timestamp '2026-07-19 19:49:10.658453', true),
    (7, 'Ginebra', 'Ginebras clásicas y premium.', 'img/categorias/ginebra.jpg', true, timestamp '2026-07-19 19:49:10.658453', true),
    (8, 'Licores, cremas y aperitivos', 'Licores dulces, cremas y aperitivos.', 'img/categorias/licores.jpg', true, timestamp '2026-07-19 19:49:10.658453', true),
    (9, 'Bebidas sin alcohol', 'Bebidas sin contenido alcohólico.', 'img/categorias/sin-alcohol.jpg', true, timestamp '2026-07-19 19:49:10.658453', false),
    (10, 'Cristalería y coctelería', 'Cristalería y accesorios para coctelería.', 'img/categorias/cristaleria.jpg', true, timestamp '2026-07-19 19:49:10.658453', false),
    (11, 'Minis y presentaciones especiales', 'Presentaciones pequeñas y ediciones especiales.', 'img/categorias/minis.jpg', true, timestamp '2026-07-19 19:49:10.658453', false)
on conflict (id_categoria) do nothing;

select setval('public.categorias_id_categoria_seq', 12, true);

insert into public.productos
    (id_producto, nombre, descripcion, precio, stock, imagen, destacado, estado, fecha_creacion, id_categoria, marca, presentacion, disponible, promocion)
overriding system value
values
    (1, 'Ron Centenario 12 Años', 'Ron añejado de alta calidad.', 18000.00, 10, 'img/productos/ron-centenario-12.jpg', true, true, timestamp '2026-07-19 20:04:36.662988', 4, 'Centenario', '750 ml', true, false),
    (2, 'Jack Daniel''s Old No. 7', 'Whisky Tennessee clásico.', 22000.00, 8, 'img/productos/Jack-daniels-old-no-7.jpg', true, true, timestamp '2026-07-19 20:04:36.662988', 3, 'Jack Daniel''s', '1 L', true, false),
    (3, 'Cerveza Corona', 'Cerveza lager de origen mexicano.', 5000.00, 20, 'img/productos/Cerveza-Corona.jpg', true, true, timestamp '2026-07-19 20:04:36.662988', 1, 'Corona', 'Paquete de 6 botellas', true, true),
    (4, 'Cacique Watermelon', 'Licor sabor sandía, ideal para disfrutar solo o en cócteles refrescantes.', 7500.00, 15, 'img/productos/cacique-watermelon.jpg', true, true, timestamp '2026-07-20 00:12:27.176077', 4, 'Cacique', '750 ml', true, false)
on conflict (id_producto) do nothing;

select setval('public.productos_id_producto_seq', 4, true);
```

## Verificación rápida (opcional, en el mismo SQL Editor)

```sql
select count(*) from public.categorias;   -- debería dar 11
select count(*) from public.productos;    -- debería dar 4
select tablename, policyname, cmd, roles from pg_policies where schemaname = 'public';
```
