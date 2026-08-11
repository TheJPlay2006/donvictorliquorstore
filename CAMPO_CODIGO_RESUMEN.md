# Campo "código" — qué agregar

## Supabase (SQL Editor del proyecto real)

```sql
alter table public.productos
    add column codigo character varying(50);

create unique index productos_codigo_key
    on public.productos (codigo)
    where codigo is not null;
```

También queda guardado como migración versionada en
`supabase/migrations/20260810190000_add_producto_codigo.sql`.

## public/admin/producto-form.html

```html
<div>
    <label for="campoCodigo">Código</label>
    <input id="campoCodigo" name="codigo" type="text" maxlength="50" placeholder="Ej: RON-001">
</div>
```

(dentro de `.admin-form-fila`, junto a Marca y Presentación)

## public/admin/js/admin/producto-form.js

En `cargarProductoParaEditar`:
```js
formulario.elements.codigo.value = producto.codigo || "";
```

En `guardarProducto`, dentro de `datosProducto`:
```js
codigo: formulario.elements.codigo.value.trim() || null,
```

## public/admin/js/admin/productos.js

En el `.select()` de `cargarProductosAdmin`:
```
id_producto, nombre, marca, codigo, descripcion, presentacion, precio, stock,
```

En `filtrarProductosAdmin`, agregar al `coincideTexto`:
```js
(producto.codigo || "").toLowerCase().includes(textoBusquedaAdmin)
```

En `crearFilaProductoAdmin`, dentro del `<span>` de info:
```js
${producto.codigo ? ` · Cód. ${escaparTextoAdmin(producto.codigo)}` : ""}
```

## public/js/catalogo.js

En el `.select()` de `cargarDatosCatalogo`:
```
id_producto, nombre, marca, codigo, descripcion, presentacion, precio, stock,
```

En `buscarProductos`, agregar constante:
```js
const codigo = (producto.codigo || "").toLowerCase();
```

Y sumar al `coincideBusqueda`:
```js
codigo.includes(textoBusqueda)
```

En la tarjeta (`tarjeta.innerHTML`), después de `producto-catalogo-presentacion`:
```html
${producto.codigo ? `<p class="producto-catalogo-codigo">Código: ${producto.codigo}</p>` : ""}
```

## public/js/categorias.js

Mismos 4 cambios que en `catalogo.js` (select, constante `codigo`, `coincideBusqueda`, tarjeta).

## public/css/estilos.css

```css
.producto-catalogo-codigo {
    font-size: 0.75rem;
    color: var(--color-texto-secundario, #8a7c74);
    margin-top: -0.25rem;
}
```
