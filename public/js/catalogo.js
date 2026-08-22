let productosCatalogo = [];
let categoriasCatalogo = [];

let textoBusqueda = "";
let categoriaSeleccionada = "todas";
let disponibilidadSeleccionada = "todas";
let productosFiltrados = [];
let cantidadVisible = obtenerCantidadInicial();


document.addEventListener("DOMContentLoaded", () => {
    cargarDatosCatalogo();
    configurarControlesCatalogo();
    configurarPanelFiltrosMovil();
    configurarCargaProgresiva();
    configurarBotonesDetalleCatalogo();
});

function obtenerCantidadInicial() {
    return window.matchMedia("(max-width: 575.98px)").matches ? 6 : 12;
}


async function cargarDatosCatalogo() {

    try {

        const [respuestaProductos, respuestaCategorias] =
            await Promise.all([
                window.supabaseClient
                    .from("productos")
                    .select(`
                        id_producto, nombre, marca, descripcion, presentacion, precio, stock,
                        imagen, destacado, promocion, disponible, estado, id_categoria, codigo,
                        categorias ( nombre )
                    `)
                    .eq("estado", true)
                    .order("fecha_creacion", { ascending: false }),
                window.supabaseClient
                    .from("categorias")
                    .select("id_categoria, nombre, descripcion, imagen, estado, fecha_creacion, mostrar_inicio")
                    .eq("estado", true)
                    .order("nombre", { ascending: true })
            ]);

        if (respuestaProductos.error || respuestaCategorias.error) {
            throw respuestaProductos.error || respuestaCategorias.error;
        }

        productosCatalogo =
            window.aplanarProductos(respuestaProductos.data);

        categoriasCatalogo =
            respuestaCategorias.data;

        mostrarFiltrosCategorias();
        buscarProductos();
        abrirProductoDesdeUrl();

    } catch (error) {

        console.error(
            "Error al cargar el catálogo:",
            error
        );

        document.getElementById(
            "cantidadProductos"
        ).textContent =
            "No fue posible cargar los productos";

        document.getElementById(
            "productosCatalogo"
        ).innerHTML = `
            <p class="mensaje-carga">
                Ocurrió un error al cargar el catálogo.
            </p>
        `;
    }

}


function abrirProductoDesdeUrl() {

    const parametros =
        new URLSearchParams(window.location.search);

    const idProducto =
        parametros.get("producto");

    if (!idProducto) {
        return;
    }

    const productoSeleccionado =
        productosCatalogo.find(
            (producto) =>
                Number(producto.id_producto) ===
                Number(idProducto)
        );

    if (!productoSeleccionado) {
        return;
    }

    mostrarModalProductoCatalogo(productoSeleccionado);

}


function mostrarCantidadProductos(cantidad) {

    const texto =
        cantidad === 1
            ? "Se encontró 1 producto"
            : `Se encontraron ${cantidad} productos`;

    document.getElementById(
        "cantidadProductos"
    ).textContent = texto;

}


function mostrarFiltrosCategorias() {

    const contenedor =
        document.getElementById(
            "filtrosCategorias"
        );

    contenedor.innerHTML = "";

    const botonTodas =
        crearBotonCategoria(
            "todas",
            "Todas las categorías",
            productosCatalogo.length,
            true
        );

    contenedor.appendChild(botonTodas);

    categoriasCatalogo.forEach((categoria) => {

        const cantidad =
            productosCatalogo.filter(
                (producto) =>
                    Number(producto.id_categoria) ===
                    Number(categoria.id_categoria)
            ).length;

        const boton =
            crearBotonCategoria(
                categoria.id_categoria,
                categoria.nombre,
                cantidad,
                false
            );

        contenedor.appendChild(boton);

    });

}


function crearBotonCategoria(
    idCategoria,
    nombre,
    cantidad,
    activo
) {

    const boton =
        document.createElement("button");

    boton.type = "button";

    boton.className =
        activo
            ? "opcion-filtro active"
            : "opcion-filtro";

    boton.dataset.categoria =
        idCategoria;

    const texto =
        document.createElement("span");

    texto.textContent =
        nombre;

    const total =
        document.createElement("span");

    total.textContent =
        cantidad;

    boton.appendChild(texto);
    boton.appendChild(total);

    return boton;

}


function mostrarProductos(productos) {

    const contenedor =
        document.getElementById(
            "productosCatalogo"
        );

    contenedor.innerHTML = "";
    productosFiltrados = productos;

    if (productos.length === 0) {

        contenedor.innerHTML = `
            <p class="mensaje-carga">
                No se encontraron productos.
            </p>
        `;

        mostrarCantidadProductos(0);
        actualizarBotonCargaProgresiva();

        return;
    }

    productos.slice(0, cantidadVisible).forEach((producto) => {

        const tarjeta =
            crearTarjetaProducto(producto);

        contenedor.appendChild(tarjeta);

    });

    mostrarCantidadProductos(
        productos.length
    );

    actualizarBotonCargaProgresiva();

}

function actualizarBotonCargaProgresiva() {
    const boton = document.getElementById("cargarMasProductos");

    if (!boton) {
        return;
    }

    const restantes = Math.max(productosFiltrados.length - cantidadVisible, 0);
    boton.classList.toggle("visible", restantes > 0);
    boton.innerHTML = restantes > 0
        ? `Cargar más <span>(${restantes})</span><i class="fa-solid fa-chevron-down" aria-hidden="true"></i>`
        : "";
}


function crearTarjetaProducto(producto) {

    const tarjeta =
        document.createElement("article");

    tarjeta.className =
        "producto-catalogo-card";

    const disponibilidad =
        obtenerDisponibilidadProducto(
            producto
        );

    const etiqueta =
        obtenerEtiquetaProducto(
            producto
        );

    const precio =
        formatearPrecio(
            producto.precio
        );

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

    if (
        producto.disponible &&
        Number(producto.stock) > 0
    ) {

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

    const precioNumerico =
        Number(precio);

    return `₡${precioNumerico.toLocaleString(
        "es-CR"
    )}`;

}


function configurarControlesCatalogo() {

    const campoBusqueda =
        document.getElementById(
            "buscarProducto"
        );

    const contenedorCategorias =
        document.getElementById(
            "filtrosCategorias"
        );

    const selectorOrden =
        document.getElementById(
            "ordenarProductos"
        );

    const botonesVista =
        document.querySelectorAll(
            ".boton-vista"
        );

    const botonesDisponibilidad =
        document.querySelectorAll(
            "[data-disponibilidad]"
        );


    campoBusqueda.addEventListener(
        "input",
        () => {

            textoBusqueda =
                campoBusqueda.value
                    .trim()
                    .toLowerCase();

            buscarProductos();

        }
    );


    contenedorCategorias.addEventListener(
        "click",
        (evento) => {

            const boton =
                evento.target.closest(
                    "[data-categoria]"
                );

            if (!boton) {
                return;
            }

            contenedorCategorias
                .querySelectorAll(
                    "[data-categoria]"
                )
                .forEach((otroBoton) => {

                    otroBoton.classList.remove(
                        "active"
                    );

                });

            boton.classList.add(
                "active"
            );

            categoriaSeleccionada =
                boton.dataset.categoria;

            actualizarResumenFiltros();
            buscarProductos();

        }
    );


    botonesDisponibilidad.forEach(
        (boton) => {

            boton.addEventListener(
                "click",
                () => {

                    botonesDisponibilidad.forEach(
                        (otroBoton) => {

                            otroBoton.classList.remove(
                                "active"
                            );

                        }
                    );

                    boton.classList.add(
                        "active"
                    );

                    disponibilidadSeleccionada =
                        boton.dataset.disponibilidad;

                    actualizarResumenFiltros();
                    buscarProductos();

                }
            );

        }
    );


    selectorOrden.addEventListener(
        "change",
        () => {

            buscarProductos();

        }
    );


    botonesVista.forEach((boton) => {

        boton.addEventListener(
            "click",
            () => {

                botonesVista.forEach(
                    (otroBoton) => {

                        otroBoton.classList.remove(
                            "active"
                        );

                    }
                );

                boton.classList.add(
                    "active"
                );

                cambiarVistaProductos(
                    boton.dataset.vista
                );

            }
        );

    });

}


function buscarProductos() {

    const productosEncontrados =
        productosCatalogo.filter(
            (producto) => {

                const nombre =
                    (
                        producto.nombre || ""
                    ).toLowerCase();

                const marca =
                    (
                        producto.marca || ""
                    ).toLowerCase();

                const categoria =
                    (
                        producto.categoria || ""
                    ).toLowerCase();

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

                const coincideCategoria =
                    categoriaSeleccionada ===
                    "todas" ||
                    Number(
                        producto.id_categoria
                    ) ===
                    Number(
                        categoriaSeleccionada
                    );

                const estadoDisponibilidad =
                    obtenerDisponibilidadProducto(
                        producto
                    ).clase;

                const coincideDisponibilidad =
                    disponibilidadSeleccionada ===
                    "todas" ||
                    estadoDisponibilidad ===
                    disponibilidadSeleccionada;

                return (
                    coincideBusqueda &&
                    coincideCategoria &&
                    coincideDisponibilidad
                );

            }
        );

    cantidadVisible = obtenerCantidadInicial();

    ordenarProductos(
        document.getElementById(
            "ordenarProductos"
        ).value,
        productosEncontrados
    );

}

function configurarCargaProgresiva() {
    const boton = document.getElementById("cargarMasProductos");

    boton?.addEventListener("click", () => {
        cantidadVisible += obtenerCantidadInicial();
        mostrarProductos(productosFiltrados);
    });
}

function configurarPanelFiltrosMovil() {
    const botonAbrir = document.getElementById("abrirFiltros");
    const botonCerrar = document.getElementById("cerrarFiltros");
    const botonAplicar = document.getElementById("aplicarFiltros");
    const fondo = document.getElementById("fondoFiltros");
    const panel = document.getElementById("filtrosCatalogo");

    if (!botonAbrir || !panel) {
        return;
    }

    const actualizarPanelInerte = (inactivo) => {
        panel.toggleAttribute("inert", inactivo);
    };

    actualizarPanelInerte(window.innerWidth < 992);

    const cerrar = () => {
        document.body.classList.remove("filtros-abiertos");
        botonAbrir.setAttribute("aria-expanded", "false");
        actualizarPanelInerte(window.innerWidth < 992);
    };

    const abrir = () => {
        actualizarPanelInerte(false);
        document.body.classList.add("filtros-abiertos");
        botonAbrir.setAttribute("aria-expanded", "true");
        botonCerrar?.focus();
    };

    botonAbrir.addEventListener("click", abrir);
    botonCerrar?.addEventListener("click", cerrar);
    botonAplicar?.addEventListener("click", cerrar);
    fondo?.addEventListener("click", cerrar);

    document.addEventListener("keydown", (evento) => {
        if (evento.key === "Escape") {
            cerrar();
        }
    });

    window.addEventListener("resize", () => {
        if (window.innerWidth >= 992) {
            cerrar();
            actualizarPanelInerte(false);
        } else if (!document.body.classList.contains("filtros-abiertos")) {
            actualizarPanelInerte(true);
        }
    });

    actualizarResumenFiltros();
}

function actualizarResumenFiltros() {
    const resumen = document.getElementById("resumenFiltros");

    if (!resumen) {
        return;
    }

    const cantidad = Number(categoriaSeleccionada !== "todas") +
        Number(disponibilidadSeleccionada !== "todas");

    resumen.textContent = String(cantidad);
}


function ordenarProductos(
    tipoOrden,
    productos = productosCatalogo
) {

    const productosOrdenados =
        [...productos];

    productosOrdenados.sort(
        (productoA, productoB) => {

            switch (tipoOrden) {

                case "nombre-desc":

                    return productoB.nombre.localeCompare(
                        productoA.nombre,
                        "es"
                    );

                case "precio-asc":

                    return (
                        Number(productoA.precio) -
                        Number(productoB.precio)
                    );

                case "precio-desc":

                    return (
                        Number(productoB.precio) -
                        Number(productoA.precio)
                    );

                case "nombre-asc":

                default:

                    return productoA.nombre.localeCompare(
                        productoB.nombre,
                        "es"
                    );

            }

        }
    );

    mostrarProductos(
        productosOrdenados
    );

}


function cambiarVistaProductos(tipoVista) {

    const contenedor =
        document.getElementById(
            "productosCatalogo"
        );

    if (tipoVista === "lista") {

        contenedor.classList.add(
            "vista-lista"
        );

    } else {

        contenedor.classList.remove(
            "vista-lista"
        );

    }

}


function configurarBotonesDetalleCatalogo() {

    const contenedor =
        document.getElementById(
            "productosCatalogo"
        );

    contenedor.addEventListener(
        "click",
        (evento) => {

            const boton =
                evento.target.closest(
                    ".btn-ver-detalle"
                );

            if (!boton) {
                return;
            }

            const productoSeleccionado =
                productosCatalogo.find(
                    (producto) =>
                        Number(producto.id_producto) ===
                        Number(boton.dataset.idProducto)
                );

            if (!productoSeleccionado) {
                return;
            }

            mostrarModalProductoCatalogo(productoSeleccionado);

        }
    );

}



