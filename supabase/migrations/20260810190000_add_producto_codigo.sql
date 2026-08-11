-- Código interno/etiqueta opcional por producto. Único cuando está presente
-- (varios productos pueden no tener código todavía).

alter table public.productos
    add column codigo character varying(50);

create unique index productos_codigo_key
    on public.productos (codigo)
    where codigo is not null;
