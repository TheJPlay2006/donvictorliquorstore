# Instrucciones: agregar el campo "Código" al panel admin y al catálogo público

Guía paso a paso para implementar la parte visual (HTML/JS) del campo `codigo`
en productos, una vez que la columna ya exista en la base de datos real.

## 0. Pre-requisito (lo hace el dueño del proyecto, no vos)

La columna `codigo` en la tabla `public.productos` de Supabase ya debe existir
antes de tocar el código de este documento. Si no estás segura, podés
confirmarlo así:

```
curl -s "https://babglruyhltjncvaryvz.supabase.co/rest/v1/productos?select=id_producto,codigo&limit=1" \
  -H "apikey: sb_publishable_6rKNR8pMDZRuvWz4hTbJSA_-aVol7Ml" \
  -H "Authorization: Bearer sb_publishable_6rKNR8pMDZRuvWz4hTbJSA_-aVol7Ml"
```

- Si devuelve JSON con productos (aunque `codigo` salga en `null`) → la columna
  existe, podés seguir.
- Si devuelve `{"code":"42703","message":"column productos.codigo does not exist"}`
  → todavía no está aplicada la migración. Avisá antes de seguir; si tocás el
  código de abajo sin la columna en la base, el catálogo público se rompe
  (pantalla de error al cargar productos) porque las consultas empiezan a
  pedir una columna que no existe.

## 1. Qué vamos a construir

Un campo `codigo` (texto libre, opcional, ej. "RON-001", código interno o de
etiqueta) que:

1. Se puede cargar/editar desde el formulario de producto en el panel admin.
2. Se muestra en el listado de productos del admin, y se puede buscar por él.
3. Se muestra como un dato chico en la tarjeta del catálogo público
   (`catalogo.html` y `categorias.html`), y también se puede buscar por él
   desde la barra de búsqueda del sitio.

Son 5 archivos a tocar. Andá en orden, y probá en el navegador después de
cada sección (no dejes todo para probar al final).

---

## 2. Panel admin — formulario de producto

### 2.1 `public/admin/producto-form.html`

Buscá este bloque (sección "Información del producto"):

```html
            <div class="admin-form-fila">
                <div>
                    <label for="campoMarca">Marca</label>
                    <input id="campoMarca" name="marca" type="text">
                </div>
                <div>
                    <label for="campoPresentacion">Presentación</label>
                    <input id="campoPresentacion" name="presentacion" type="text" placeholder="Ej: 750 ml">
                </div>
            </div>
```

Reemplazalo por (agrega un tercer campo `codigo` en la misma fila):

```html
            <div class="admin-form-fila admin-form-fila-3">
                <div>
                    <label for="campoMarca">Marca</label>
                    <input id="campoMarca" name="marca" type="text">
                </div>
                <div>
                    <label for="campoPresentacion">Presentación</label>
                    <input id="campoPresentacion" name="presentacion" type="text" placeholder="Ej: 750 ml">
                </div>
                <div>
                    <label for="campoCodigo">Código</label>
                    <input id="campoCodigo" name="codigo" type="text" maxlength="50" placeholder="Ej: RON-001">
                </div>
            </div>
```

`admin-form-fila` hoy está pensada para 2 columnas (`.admin-form-fila > div`
con `flex: 1` probablemente en `css/admin.css`). Si al probar en el navegador
ves los 3 campos apretados o mal alineados, revisá `public/admin/css/admin.css`
y agregá algo así (ajustá el nombre exacto de la clase base si es distinto):

```css
.admin-form-fila-3 {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
}
.admin-form-fila-3 > div {
    flex: 1 1 180px;
}
```

Si preferís no arriesgar el layout, la alternativa más simple es dejar Marca
y Presentación como están y agregar Código en su propia fila de un solo
campo, igual que "Nombre":

```html
            <label for="campoCodigo">Código</label>
            <input id="campoCodigo" name="codigo" type="text" maxlength="50" placeholder="Ej: RON-001">
```

Elegí la opción que se vea mejor una vez que lo veas renderizado — no hay
una correcta objetiva acá, es criterio visual tuyo.

### 2.2 `public/admin/js/admin/producto-form.js`

**a) Cargar el valor al editar** — en `cargarProductoParaEditar`, buscá:

```js
    formulario.elements.marca.value = producto.marca || "";
    formulario.elements.presentacion.value = producto.presentacion || "";
```

Y agregá justo debajo:

```js
    formulario.elements.codigo.value = producto.codigo || "";
```

**b) Guardar el valor** — en `guardarProducto`, buscá el objeto `datosProducto`:

```js
        const datosProducto = {
            nombre: formulario.elements.nombre.value.trim(),
            marca: formulario.elements.marca.value.trim() || null,
            presentacion: formulario.elements.presentacion.value.trim() || null,
```

Y agregá una línea (mismo patrón que `marca`/`presentacion`: string vacío →
`null`, para que el índice único `productos_codigo_key` de la migración no
choque con múltiples productos con código vacío):

```js
        const datosProducto = {
            nombre: formulario.elements.nombre.value.trim(),
            marca: formulario.elements.marca.value.trim() || null,
            presentacion: formulario.elements.presentacion.value.trim() || null,
            codigo: formulario.elements.codigo.value.trim() || null,
```

⚠️ Importante: la migración crea un índice único parcial
(`where codigo is not null`), es decir, **dos productos no pueden tener el
mismo código**, pero sí pueden tener ambos el código vacío/null. Si al
guardar aparece un error de "duplicate key value violates unique constraint
productos_codigo_key", es exactamente eso: ya existe otro producto con ese
código. Mostralo tal cual en el feedback (ya lo hace `catch`, no hace falta
tocar nada ahí) o, si querés un mensaje más lindo, en el `catch` de
`guardarProducto` podés chequear `error.code === "23505"` y mostrar algo como
"Ese código ya está en uso por otro producto."

---

## 3. Panel admin — listado de productos

### 3.1 `public/admin/js/admin/productos.js`

**a) Traer la columna en la consulta** — en `cargarProductosAdmin`, buscá:

```js
                .select(`
                    id_producto, nombre, marca, descripcion, presentacion, precio, stock,
                    imagen, destacado, promocion, disponible, estado, id_categoria,
                    categorias ( nombre )
                `)
```

Agregá `codigo` a la lista de columnas:

```js
                .select(`
                    id_producto, nombre, marca, codigo, descripcion, presentacion, precio, stock,
                    imagen, destacado, promocion, disponible, estado, id_categoria,
                    categorias ( nombre )
                `)
```

**b) Incluirlo en la búsqueda del admin** — en `filtrarProductosAdmin`, buscá:

```js
        const coincideTexto =
            !textoBusquedaAdmin ||
            (producto.nombre || "").toLowerCase().includes(textoBusquedaAdmin) ||
            (producto.marca || "").toLowerCase().includes(textoBusquedaAdmin);
```

Reemplazá por:

```js
        const coincideTexto =
            !textoBusquedaAdmin ||
            (producto.nombre || "").toLowerCase().includes(textoBusquedaAdmin) ||
            (producto.marca || "").toLowerCase().includes(textoBusquedaAdmin) ||
            (producto.codigo || "").toLowerCase().includes(textoBusquedaAdmin);
```

**c) Mostrarlo en cada fila** — en `crearFilaProductoAdmin`, buscá:

```js
        <div class="admin-fila-info">
            <strong>${escaparTextoAdmin(producto.nombre)}</strong>
            <span>${escaparTextoAdmin(producto.marca || "Sin marca")} · ${escaparTextoAdmin(producto.categoria || "Sin categoría")}</span>
        </div>
```

Reemplazá por (el código solo se muestra si existe, para no llenar de
"· Sin código" todas las filas de productos viejos que todavía no lo tienen
cargado):

```js
        <div class="admin-fila-info">
            <strong>${escaparTextoAdmin(producto.nombre)}</strong>
            <span>${escaparTextoAdmin(producto.marca || "Sin marca")} · ${escaparTextoAdmin(producto.categoria || "Sin categoría")}${producto.codigo ? ` · Cód. ${escaparTextoAdmin(producto.codigo)}` : ""}</span>
        </div>
```

No hace falta CSS nuevo acá, reutiliza el mismo `<span>` que ya existe.

**Probá esto ahora**: entrá al admin, editá un producto, cargale un código,
guardá, y confirmá que aparece en el listado y que el buscador del admin lo
encuentra al escribir el código.

---

## 4. Catálogo público

Mismo patrón se repite en dos archivos casi idénticos:
`public/js/catalogo.js` (página `catalogo.html`) y `public/js/categorias.js`
(página `categorias.html`, productos filtrados por categoría). Hacé el mismo
cambio en los dos.

### 4.1 `public/js/catalogo.js`

**a) Consulta** — buscá (dentro de `cargarDatosCatalogo`):

```js
                    .select(`
                        id_producto, nombre, marca, descripcion, presentacion, precio, stock,
                        imagen, destacado, promocion, disponible, estado, id_categoria,
                        categorias ( nombre )
                    `)
```

Agregá `codigo`:

```js
                    .select(`
                        id_producto, nombre, marca, codigo, descripcion, presentacion, precio, stock,
                        imagen, destacado, promocion, disponible, estado, id_categoria,
                        categorias ( nombre )
                    `)
```

**b) Búsqueda** — en `buscarProductos`, buscá:

```js
                const coincideBusqueda =
                    nombre.includes(
                        textoBusqueda
                    ) ||
                    marca.includes(
                        textoBusqueda
                    ) ||
                    categoria.includes(
                        textoBusqueda
                    );
```

Y justo arriba, donde se declaran `nombre`/`marca`/`categoria`, agregá una
constante `codigo` siguiendo el mismo patrón:

```js
                const codigo =
                    (
                        producto.codigo || ""
                    ).toLowerCase();
```

y sumala al `||`:

```js
                const coincideBusqueda =
                    nombre.includes(
                        textoBusqueda
                    ) ||
                    marca.includes(
                        textoBusqueda
                    ) ||
                    categoria.includes(
                        textoBusqueda
                    ) ||
                    codigo.includes(
                        textoBusqueda
                    );
```

**c) Mostrarlo en la tarjeta** — buscá el bloque de la tarjeta (dentro de la
función que arma `tarjeta.innerHTML`):

```html
            <p class="producto-catalogo-categoria">
                ${producto.marca || "Sin marca"} ·
                ${producto.categoria}
            </p>

            <h3>
                ${producto.nombre}
            </h3>

            <p class="producto-catalogo-presentacion">
                ${producto.presentacion ||
        "Presentación por consultar"
        }
            </p>
```

Agregá el código como una línea chica debajo de la presentación, solo si
existe:

```html
            <p class="producto-catalogo-categoria">
                ${producto.marca || "Sin marca"} ·
                ${producto.categoria}
            </p>

            <h3>
                ${producto.nombre}
            </h3>

            <p class="producto-catalogo-presentacion">
                ${producto.presentacion ||
        "Presentación por consultar"
        }
            </p>

            ${producto.codigo
            ? `<p class="producto-catalogo-codigo">Código: ${producto.codigo}</p>`
            : ""
        }
```

Esto va a salir sin estilo particular (hereda el estilo de párrafo normal)
hasta que le agregues una regla en `public/css/estilos.css`, por ejemplo:

```css
.producto-catalogo-codigo {
    font-size: 0.75rem;
    color: var(--color-texto-secundario, #8a7c74);
    margin-top: -0.25rem;
}
```

Ajustá el nombre de la variable de color al que realmente exista en tu hoja
de estilos (revisá el `:root` de `estilos.css` — es la parte "visual" que te
toca a vos definir con criterio de diseño, esto es solo un punto de partida
funcional).

### 4.2 `public/js/categorias.js`

Repetí exactamente los mismos 3 cambios (a, b, c) de la sección 4.1 — la
estructura del archivo es prácticamente un espejo de `catalogo.js` (mismo
`select()`, misma lógica de búsqueda/filtrado, misma tarjeta HTML). Buscá los
mismos bloques ahí y aplicá el mismo patrón.

---

## 5. Opcional (no obligatorio para el lanzamiento)

Estos dos archivos también muestran tarjetas de producto pero **no es
necesario tocarlos** para que el sitio funcione — decisión tuya si le da
valor visual mostrarlos ahí también, mismo patrón (a/b/c de arriba):

- `public/js/inicio.js` — tarjetas de productos destacados en el home.
- `public/js/modal-producto.js` — el modal de "Ver detalle" de un producto.

---

## 6. Checklist de pruebas antes de avisar que está listo

1. Admin → crear un producto nuevo con código → guardar → no debe dar error.
2. Admin → crear otro producto con el **mismo** código → guardar → debe dar
   un error claro (constraint `productos_codigo_key`), no debe romper la
   página.
3. Admin → dejar código vacío en dos productos distintos → guardar ambos →
   no debe dar error (el índice único ignora los `null`).
4. Admin → listado de productos → el código aparece en la fila y el buscador
   del admin encuentra un producto escribiendo su código.
5. `catalogo.html` en el navegador → carga sin errores en la consola → el
   código aparece en las tarjetas que lo tienen, no rompe el layout en las
   que no lo tienen.
6. Buscador del catálogo público → escribir un código existente → aparece el
   producto correspondiente.
7. `categorias.html` → repetir los puntos 5 y 6 ahí.
8. Mirar en el celular (o achicando la ventana) que la tarjeta no se vea
   rota con la línea nueva del código.

## 7. Al terminar

No hagas commit directo a `main`. Guardá los cambios en una rama:

```
git checkout -b feature/campo-codigo-producto
git add public/admin/producto-form.html public/admin/js/admin/producto-form.js public/admin/js/admin/productos.js public/js/catalogo.js public/js/categorias.js public/css/estilos.css public/admin/css/admin.css
git commit -m "feat: agregar campo codigo a formulario, listado admin y catalogo publico"
git push -u origin feature/campo-codigo-producto
```

(Ajustá la lista de `git add` a los archivos que realmente hayas tocado.)
Avisale al resto del equipo cuando esté pusheado para revisar y mergear a
`main` — no hace falta volver a tocar Supabase, esa parte ya la aplicó otra
persona por su cuenta.
