let categoriasPagina = [];
let productosPagina = [];

document.addEventListener("DOMContentLoaded", () => {
    cargarDatosCategorias();
    configurarBotonesDetalle();
});

async function cargarDatosCategorias() {
    const contenedor =
        document.getElementById("categoriasPaginaGrid");

    try {
        const [respuestaCategorias, respuestaProductos] =
            await Promise.all([
                window.supabaseClient
                    .from("categorias")
                    .select("id_categoria, nombre, descripcion, imagen, estado, fecha_creacion, mostrar_inicio")
                    .eq("estado", true)
                    .order("nombre", { ascending: true }),
                window.supabaseClient
                    .from("productos")
                    .select(`
                        id_producto, nombre, marca, descripcion, presentacion, precio, stock,
                        imagen, destacado, promocion, disponible, estado, id_categoria, codigo,
                        categorias ( nombre )
                    `)
                    .eq("estado", true)
                    .order("fecha_creacion", { ascending: false })
            ]);

        if (respuestaCategorias.error || respuestaProductos.error) {
            throw respuestaCategorias.error || respuestaProductos.error;
        }

        categoriasPagina = respuestaCategorias.data;
        productosPagina = window.aplanarProductos(respuestaProductos.data);

        const parametrosUrl = new URLSearchParams(window.location.search);
        const categoriaSlug = parametrosUrl.get("categoria");

        const categoriaSeleccionada = categoriasPagina.find(
            (categoria) =>
                crearSlug(categoria.nombre) === categoriaSlug
        );

        if (categoriaSeleccionada) {
            mostrarProductosCategoria(categoriaSeleccionada);
        } else {
            mostrarCategoriasPagina();
        }

    } catch (error) {
        console.error(
            "Error al cargar las categorías:",
            error
        );

        contenedor.innerHTML = `
            <p class="mensaje-carga">
                No fue posible cargar las categorías.
            </p>
        `;
    }
}
function mostrarCategoriasPagina() {
    const contenedor =
        document.getElementById("categoriasPaginaGrid");

    contenedor.innerHTML = "";

    categoriasPagina.forEach((categoria) => {
        const cantidadProductos = productosPagina.filter(
            (producto) =>
                Number(producto.id_categoria) ===
                Number(categoria.id_categoria)
        ).length;

        const tarjeta = document.createElement("a");

        tarjeta.className = "categoria-pagina-card";

        tarjeta.href =
            `categorias.html?categoria=${crearSlug(categoria.nombre)}`;

        const imagenContenedor =
            document.createElement("div");

        imagenContenedor.className =
            "categoria-pagina-imagen";

        const imagen = document.createElement("img");

        imagen.src = categoria.imagen;
        imagen.alt = categoria.nombre;
        imagen.loading = "lazy";

        imagenContenedor.appendChild(imagen);

        const contenido = document.createElement("div");

        contenido.className =
            "categoria-pagina-contenido";

        const titulo = document.createElement("h2");
        titulo.textContent = categoria.nombre;

        const descripcion = document.createElement("p");

        descripcion.textContent =
            categoria.descripcion ||
            "Productos disponibles en esta categoría.";

        const pie = document.createElement("div");

        pie.className = "categoria-pagina-pie";

        const cantidad = document.createElement("span");

        cantidad.className = "cantidad-categoria";

        cantidad.textContent =
            cantidadProductos === 1
                ? "1 producto"
                : `${cantidadProductos} productos`;

        const enlace = document.createElement("span");

        enlace.className = "enlace-categoria";

        enlace.innerHTML = `
            Ver productos
            <i class="fa-solid fa-arrow-right"></i>
        `;

        pie.appendChild(cantidad);
        pie.appendChild(enlace);

        contenido.appendChild(titulo);
        contenido.appendChild(descripcion);
        contenido.appendChild(pie);

        tarjeta.appendChild(imagenContenedor);
        tarjeta.appendChild(contenido);

        contenedor.appendChild(tarjeta);
    });
}

function mostrarProductosCategoria(categoria) {

    const titulo = document.getElementById("tituloCategorias");
    const subtitulo = document.getElementById("subtituloCategorias");

    titulo.textContent = categoria.nombre;

    subtitulo.textContent =
        "Explorá los productos de esta categoria";

    const contenedor =
        document.getElementById("categoriasPaginaGrid");

    contenedor.innerHTML = "";
    contenedor.className = "productos-grid";

    const productosCategoria = productosPagina.filter(
        (producto) =>
            Number(producto.id_categoria) ===
            Number(categoria.id_categoria)
    );

    if (productosCategoria.length === 0) {

        contenedor.innerHTML = `
        <p class="mensaje-carga">
            No hay productos disponibles en esta categoría.
        </p>
    `;

        return;
    }

    productosCategoria.forEach((producto) => {
        const tarjeta = crearTarjetaProducto(producto);

        contenedor.appendChild(tarjeta);
    });

}

function obtenerEtiquetaProducto(producto) {
    if (producto.promocion) {
        return {
            texto: "Promoción",
            clase: "promocion"
        };
    }

    if (producto.destacado) {
        return {
            texto: "Destacado",
            clase: "destacado"
        };
    }

    return null;
}

function obtenerDisponibilidadProducto(producto) {
    if (producto.disponible && Number(producto.stock) > 0) {
        return {
            texto: "Disponible",
            clase: "disponible"
        };
    }

    if (Number(producto.stock) <= 0) {
        return {
            texto: "Agotado",
            clase: "agotado"
        };
    }

    return {
        texto: "Consultar",
        clase: "consultar"
    };
}

function formatearPrecio(precio) {
    const precioNumerico = Number(precio);

    return `₡${precioNumerico.toLocaleString("es-CR")}`;
}

function crearTarjetaProducto(producto) {
    const tarjeta = document.createElement("article");

    tarjeta.className = "producto-catalogo-card";

    const disponibilidad =
        obtenerDisponibilidadProducto(producto);

    const etiqueta =
        obtenerEtiquetaProducto(producto);

    const precio =
        formatearPrecio(producto.precio);

    const enlaceWhatsApp =
        crearEnlaceWhatsAppConsulta(producto);

    tarjeta.innerHTML = `
        <div class="producto-catalogo-imagen">

            ${etiqueta
            ? `
                        <span class="producto-etiqueta ${etiqueta.clase}">
                            ${etiqueta.texto}
                        </span>
                    `
            : ""
        }

            <img
                src="${producto.imagen}"
                alt="${producto.nombre}"
                loading="lazy"
            >

        </div>

        <div class="producto-catalogo-contenido">

            <p class="producto-catalogo-categoria">
                ${producto.marca || "Sin marca"} · ${producto.categoria}
            </p>

            <h3>${producto.nombre}</h3>

            <p class="producto-catalogo-presentacion">
                ${producto.presentacion || "Presentación por consultar"}
            </p>

            <div class="producto-catalogo-info">

                <span class="producto-catalogo-precio">
                    ${precio}
                </span>

                <span class="estado-producto ${disponibilidad.clase}">
                    <i class="fa-solid fa-circle-check"></i>
                    ${disponibilidad.texto}
                </span>

            </div>

            <div class="producto-catalogo-acciones">

                <button
                    type="button"
                    class="btn-ver-detalle"
                    data-id-producto="${producto.id_producto}"
                >
                    <i class="fa-regular fa-eye"></i>
                    Ver detalle
                </button>

                <a
                    href="${enlaceWhatsApp}"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="btn-producto-whatsapp"
                    aria-label="Consultar ${producto.nombre} por WhatsApp"
                >
                    <i class="fa-brands fa-whatsapp"></i>
                </a>

            </div>

        </div>
    `;

    return tarjeta;
}

function configurarBotonesDetalle() {
    const contenedor =
        document.getElementById("categoriasPaginaGrid");

    contenedor.addEventListener("click", (evento) => {
        const boton = evento.target.closest(".btn-ver-detalle");

        if (!boton) {
            return;
        }

        const productoSeleccionado = productosPagina.find(
            (producto) =>
                Number(producto.id_producto) ===
                Number(boton.dataset.idProducto)
        );

        if (!productoSeleccionado) {
            return;
        }

        mostrarModalProductoCatalogo(productoSeleccionado);
    });
}

function crearSlug(texto) {
    return String(texto || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}