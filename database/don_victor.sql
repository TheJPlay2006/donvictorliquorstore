--
-- PostgreSQL database dump
--

\restrict lCbS6He8OZbfveoCZbychIhaCCM0rqgrGeUX1OJ5pz9JMVIc7ngjNbDqktREfmR

-- Dumped from database version 18.4
-- Dumped by pg_dump version 18.4

-- Started on 2026-07-26 21:57:41

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 4 (class 2615 OID 2200)
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS public;


--
-- TOC entry 5035 (class 0 OID 0)
-- Dependencies: 4
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 220 (class 1259 OID 16390)
-- Name: categorias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categorias (
    id_categoria integer NOT NULL,
    nombre character varying(100) NOT NULL,
    descripcion text,
    imagen character varying(255),
    estado boolean DEFAULT true NOT NULL,
    fecha_creacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    mostrar_inicio boolean DEFAULT false NOT NULL
);


--
-- TOC entry 219 (class 1259 OID 16389)
-- Name: categorias_id_categoria_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.categorias ALTER COLUMN id_categoria ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.categorias_id_categoria_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 222 (class 1259 OID 16405)
-- Name: productos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.productos (
    id_producto integer NOT NULL,
    nombre character varying(150) NOT NULL,
    descripcion text,
    precio numeric(10,2) NOT NULL,
    stock integer DEFAULT 0 NOT NULL,
    imagen character varying(255),
    destacado boolean DEFAULT false NOT NULL,
    estado boolean DEFAULT true NOT NULL,
    fecha_creacion timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    id_categoria integer NOT NULL,
    marca character varying(100),
    presentacion character varying(100),
    disponible boolean DEFAULT true NOT NULL,
    promocion boolean DEFAULT false NOT NULL,
    CONSTRAINT productos_precio_check CHECK ((precio >= (0)::numeric)),
    CONSTRAINT productos_stock_check CHECK ((stock >= 0))
);


--
-- TOC entry 221 (class 1259 OID 16404)
-- Name: productos_id_producto_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.productos ALTER COLUMN id_producto ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.productos_id_producto_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 5027 (class 0 OID 16390)
-- Dependencies: 220
-- Data for Name: categorias; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.categorias (id_categoria, nombre, descripcion, imagen, estado, fecha_creacion, mostrar_inicio) FROM stdin;
9	Bebidas sin alcohol	Bebidas sin contenido alcohólico.	img/categorias/sin-alcohol.jpg	t	2026-07-19 19:49:10.658453	f
10	Cristalería y coctelería	Cristalería y accesorios para coctelería.	img/categorias/cristaleria.jpg	t	2026-07-19 19:49:10.658453	f
11	Minis y presentaciones especiales	Presentaciones pequeñas y ediciones especiales.	img/categorias/minis.jpg	t	2026-07-19 19:49:10.658453	f
2	Vinos y espumantes	Vinos tintos, blancos, rosados y espumantes.	img/categorias/vinos.jpg	t	2026-07-19 19:49:10.658453	t
3	Whisky y bourbon	Whiskys y bourbons nacionales e importados.	img/categorias/Whisky.jpg	t	2026-07-19 19:49:10.658453	t
1	Cervezas	Cervezas nacionales e importadas.	img/categorias/cervezas.jpg	t	2026-07-19 19:49:10.658453	t
4	Ron	Rones blancos, añejos y premium.	img/categorias/ron.jpg	t	2026-07-19 19:49:10.658453	t
5	Vodka	Vodkas nacionales e importados.	img/categorias/vodka.jpg	t	2026-07-19 19:49:10.658453	t
6	Tequila y mezcal	Tequilas y mezcales para todos los gustos.	img/categorias/tequila.jpg	t	2026-07-19 19:49:10.658453	t
7	Ginebra	Ginebras clásicas y premium.	img/categorias/ginebra.jpg	t	2026-07-19 19:49:10.658453	t
8	Licores, cremas y aperitivos	Licores dulces, cremas y aperitivos.	img/categorias/licores.jpg	t	2026-07-19 19:49:10.658453	t
\.


--
-- TOC entry 5029 (class 0 OID 16405)
-- Dependencies: 222
-- Data for Name: productos; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.productos (id_producto, nombre, descripcion, precio, stock, imagen, destacado, estado, fecha_creacion, id_categoria, marca, presentacion, disponible, promocion) FROM stdin;
1	Ron Centenario 12 Años	Ron añejado de alta calidad.	18000.00	10	img/productos/ron-centenario-12.jpg	t	t	2026-07-19 20:04:36.662988	4	Centenario	750 ml	t	f
2	Jack Daniel's Old No. 7	Whisky Tennessee clásico.	22000.00	8	img/productos/Jack-daniels-old-no-7.jpg	t	t	2026-07-19 20:04:36.662988	3	Jack Daniel's	1 L	t	f
3	Cerveza Corona	Cerveza lager de origen mexicano.	5000.00	20	img/productos/Cerveza-Corona.jpg	t	t	2026-07-19 20:04:36.662988	1	Corona	Paquete de 6 botellas	t	t
4	Cacique Watermelon	Licor sabor sandía, ideal para disfrutar solo o en cócteles refrescantes.	7500.00	15	img/productos/cacique-watermelon.jpg	t	t	2026-07-20 00:12:27.176077	4	Cacique	750 ml	t	f
\.


--
-- TOC entry 5036 (class 0 OID 0)
-- Dependencies: 219
-- Name: categorias_id_categoria_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.categorias_id_categoria_seq', 12, true);


--
-- TOC entry 5037 (class 0 OID 0)
-- Dependencies: 221
-- Name: productos_id_producto_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.productos_id_producto_seq', 4, true);


--
-- TOC entry 4873 (class 2606 OID 16403)
-- Name: categorias categorias_nombre_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categorias
    ADD CONSTRAINT categorias_nombre_key UNIQUE (nombre);


--
-- TOC entry 4875 (class 2606 OID 16401)
-- Name: categorias categorias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categorias
    ADD CONSTRAINT categorias_pkey PRIMARY KEY (id_categoria);


--
-- TOC entry 4877 (class 2606 OID 16424)
-- Name: productos productos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_pkey PRIMARY KEY (id_producto);


--
-- TOC entry 4878 (class 2606 OID 16425)
-- Name: productos fk_productos_categorias; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT fk_productos_categorias FOREIGN KEY (id_categoria) REFERENCES public.categorias(id_categoria) ON UPDATE CASCADE ON DELETE RESTRICT;


-- Completed on 2026-07-26 21:57:42

--
-- PostgreSQL database dump complete
--

\unrestrict lCbS6He8OZbfveoCZbychIhaCCM0rqgrGeUX1OJ5pz9JMVIc7ngjNbDqktREfmR

