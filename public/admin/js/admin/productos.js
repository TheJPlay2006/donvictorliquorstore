const PLACEHOLDER_IMAGEN_ADMIN =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' fill='%232B1A16'/%3E%3Cpath d='M24 14h16v6l4 4v26a2 2 0 0 1-2 2H22a2 2 0 0 1-2-2V24l4-4z' fill='none' stroke='%23B6AAA3' stroke-width='2'/%3E%3C/svg%3E";

let productosAdmin = [];
let categoriasAdmin = [];
let textoBusquedaAdmin = "";
let categoriaFiltradaAdmin = "todas";

document.addEventListener("admin-listo", () => {
    cargarProductosAdmin();
    configurarControlesProductosAdmin();
});

async function cargarProductosAdmin() {
    const contenedor = document.getElementById("adminListaProductos");

    try {
        const [respuestaProductos, respuestaCategorias] = await Promise.all([
            window.supabaseClient
                .from("productos")
                .select(`
                    id_producto, nombre, marca, descripcion, presentacion, precio, stock,
                    imagen, destacado, promocion, disponible, estado, id_categoria, codigo,
                    categorias ( nombre )
                `)
                .order("fecha_creacion", { ascending: false }),
            window.supabaseClient
                .from("categorias")
                .select("id_categoria, nombre")
                .order("nombre", { ascending: true })
        ]);

        if (respuestaProductos.error || respuestaCategorias.error) {
            throw respuestaProductos.error || respuestaCategorias.error;
        }

        productosAdmin = window.aplanarProductos(respuestaProductos.data);
        categoriasAdmin = respuestaCategorias.data;

        llenarFiltroCategoriasAdmin();
        renderizarProductosAdmin();
    } catch (error) {
        console.error("Error al cargar productos (admin):", error);
        contenedor.innerHTML = `<p class="admin-mensaje-error">No fue posible cargar los productos.</p>`;
    }
}

function llenarFiltroCategoriasAdmin() {
    const select = document.getElementById("adminFiltroCategoria");

    categoriasAdmin.forEach((categoria) => {
        const opcion = document.createElement("option");
        opcion.value = String(categoria.id_categoria);
        opcion.textContent = categoria.nombre;
        select.appendChild(opcion);
    });
}

function configurarControlesProductosAdmin() {
    document.getElementById("adminBuscarProducto").addEventListener("input", (evento) => {
        textoBusquedaAdmin = evento.target.value.trim().toLowerCase();
        renderizarProductosAdmin();
    });

    document.getElementById("adminFiltroCategoria").addEventListener("change", (evento) => {
        categoriaFiltradaAdmin = evento.target.value;
        renderizarProductosAdmin();
    });
}

function filtrarProductosAdmin() {
    return productosAdmin.filter((producto) => {
        const coincideTexto =
            !textoBusquedaAdmin ||
            (producto.nombre || "").toLowerCase().includes(textoBusquedaAdmin) ||
            (producto.marca || "").toLowerCase().includes(textoBusquedaAdmin);

        const coincideCategoria =
            categoriaFiltradaAdmin === "todas" ||
            Number(producto.id_categoria) === Number(categoriaFiltradaAdmin);

        return coincideTexto && coincideCategoria;
    });
}

function renderizarProductosAdmin() {
    const contenedor = document.getElementById("adminListaProductos");
    const productosFiltrados = filtrarProductosAdmin();

    document.getElementById("adminProductosCantidad").textContent =
        productosFiltrados.length === 1
            ? "1 producto"
            : `${productosFiltrados.length} productos`;

    if (productosFiltrados.length === 0) {
        contenedor.innerHTML = `<p class="admin-mensaje-vacio">No hay productos que coincidan.</p>`;
        return;
    }

    contenedor.innerHTML = "";

    productosFiltrados.forEach((producto) => {
        contenedor.appendChild(crearFilaProductoAdmin(producto));
    });
}

function crearFilaProductoAdmin(producto) {
    const fila = document.createElement("article");
    fila.className = "admin-fila";

    fila.innerHTML = `
        <img class="admin-fila-miniatura" src="${escaparAtributoAdmin(window.resolverRutaImagenAdmin(producto.imagen) || PLACEHOLDER_IMAGEN_ADMIN)}" alt="" loading="lazy" onerror="this.onerror=null;this.src='${PLACEHOLDER_IMAGEN_ADMIN}';">

        <div class="admin-fila-info">
            <strong>${escaparTextoAdmin(producto.nombre)}</strong>
            <span>${escaparTextoAdmin(producto.marca || "Sin marca")} · ${escaparTextoAdmin(producto.categoria || "Sin categoría")}${producto.codigo ? ` · ${escaparTextoAdmin(producto.codigo)}` : ""}</span>
        </div>

        <div class="admin-fila-precio">₡${Number(producto.precio).toLocaleString("es-CR")}</div>
        <div class="admin-fila-stock">Stock: ${Number(producto.stock)}</div>

        <div class="admin-fila-badges">
            <button type="button" class="admin-badge-toggle ${producto.disponible ? "activo" : ""}" data-campo="disponible">Disponible</button>
            <button type="button" class="admin-badge-toggle ${producto.destacado ? "activo" : ""}" data-campo="destacado">Destacado</button>
            <button type="button" class="admin-badge-toggle ${producto.promocion ? "activo" : ""}" data-campo="promocion">Promoción</button>
            <button type="button" class="admin-badge-toggle admin-badge-estado ${producto.estado ? "activo" : ""}" data-campo="estado">${producto.estado ? "Activo" : "Desactivado"}</button>
        </div>

        <a class="admin-boton-secundario" href="producto-form.html?id=${producto.id_producto}">
            <i class="fa-solid fa-pen" aria-hidden="true"></i>
            Editar
        </a>
    `;

    fila.querySelectorAll(".admin-badge-toggle").forEach((boton) => {
        boton.addEventListener("click", () => {
            togglearCampoProductoAdmin(producto, boton.dataset.campo, boton);
        });
    });

    return fila;
}

async function togglearCampoProductoAdmin(producto, campo, boton) {
    const valorAnterior = producto[campo];
    const valorNuevo = !valorAnterior;

    producto[campo] = valorNuevo;
    boton.classList.toggle("activo", valorNuevo);

    if (campo === "estado") {
        boton.textContent = valorNuevo ? "Activo" : "Desactivado";
    }

    const { error } = await window.supabaseClient
        .from("productos")
        .update({ [campo]: valorNuevo })
        .eq("id_producto", producto.id_producto);

    if (error) {
        console.error("Error al actualizar producto:", error);
        producto[campo] = valorAnterior;
        boton.classList.toggle("activo", valorAnterior);
        if (campo === "estado") {
            boton.textContent = valorAnterior ? "Activo" : "Desactivado";
        }
        alert("No se pudo guardar el cambio. Intentá de nuevo.");
    }
}

function escaparTextoAdmin(texto) {
    const contenedor = document.createElement("div");
    contenedor.textContent = texto == null ? "" : String(texto);
    return contenedor.innerHTML;
}

function escaparAtributoAdmin(texto) {
    return escaparTextoAdmin(texto).replace(/"/g, "&quot;");
}
