-- Datos semilla, tomados verbatim de database/don_victor.sql (dump original,
-- se conserva como respaldo histórico). No se inventaron ni alteraron datos.
--
-- Las PK son GENERATED ALWAYS AS IDENTITY: los INSERT con id explícito
-- requieren OVERRIDING SYSTEM VALUE, y las secuencias se resincronizan
-- después con setval para que coincidan con el dump original (incluyendo el
-- gap real de ids 9-11 en categorías, que ya existía en el dump: la
-- secuencia estaba en 12 aunque el id máximo real es 11).

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
