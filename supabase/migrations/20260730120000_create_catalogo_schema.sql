-- Réplica del schema de database/don_victor.sql (mismos nombres de columna,
-- tipos y constraints: el frontend depende literalmente de estos nombres).

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
