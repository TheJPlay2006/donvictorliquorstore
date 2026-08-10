let productosDestacados = [];

document.addEventListener('DOMContentLoaded', () => {
    cargarCategorias();
    cargarProductosDestacados();
    configurarBotonesDetalle();
});

/* ==========================
   CATEGORÍAS
========================== */

async function cargarCategorias() {
    const categoriasGrid = document.getElementById('categoriasGrid');

    if (!categoriasGrid) {
        return;
    }

    try {
        const { data, error } = await window.supabaseClient
            .from('categorias')
            .select('id_categoria, nombre, descripcion, imagen, estado, fecha_creacion, mostrar_inicio')
            .eq('estado', true)
            .eq('mostrar_inicio', true)
            .order('nombre', { ascending: true });

        if (error) {
            throw error;
        }

        mostrarCategorias((data || []).slice(0, 4));
    } catch (error) {
        console.error('Error al cargar las categorías:', error);

        categoriasGrid.innerHTML = `
            <p class="mensaje-error">
                No fue posible cargar las categorías.
            </p>
        `;
    }
}

function mostrarCategorias(categorias) {
    const categoriasGrid = document.getElementById('categoriasGrid');

    if (!categoriasGrid) {
        return;
    }

    if (!Array.isArray(categorias) || categorias.length === 0) {
        categoriasGrid.innerHTML = `
            <p>No hay categorías disponibles.</p>
        `;

        return;
    }


    categoriasGrid.innerHTML = categorias
        .map((categoria) => {
            const nombre = escaparHTML(categoria.nombre);
            const imagen = escaparHTML(categoria.imagen);
            const slug = crearSlug(categoria.nombre);

            return `
                <a
                    href="categorias.html?categoria=${encodeURIComponent(slug)}"
                    class="categoria-card"
                >
                    <img
                        src="${imagen}"
                        alt="${nombre}"
                        loading="lazy"
                    >

                    <div class="categoria-overlay"></div>

                    <div class="categoria-contenido">
                        <h2>${nombre}</h2>

                        <span>
                            Ver productos
                            <i class="fa-solid fa-arrow-right"></i>
                        </span>
                    </div>
                </a>
            `;
        })
        .join('');
}

/* ==========================
   PRODUCTOS DESTACADOS
========================== */

async function cargarProductosDestacados() {
    const productosGrid = document.getElementById(
        'productosDestacadosGrid'
    );

    if (!productosGrid) {
        return;
    }

    try {
        const { data, error } = await window.supabaseClient
            .from('productos')
            .select(`
                id_producto, nombre, marca, descripcion, presentacion, precio, stock,
                imagen, destacado, promocion, disponible, estado, id_categoria,
                categorias ( nombre )
            `)
            .eq('estado', true)
            .eq('disponible', true)
            .eq('destacado', true)
            .order('fecha_creacion', { ascending: false })
            .limit(4);

        if (error) {
            throw error;
        }

        productosDestacados = window.aplanarProductos(data);

        mostrarProductosDestacados(productosDestacados);
    } catch (error) {
        console.error(
            'Error al cargar productos destacados:',
            error
        );

        productosGrid.innerHTML = `
            <p class="mensaje-error">
                No fue posible cargar los productos destacados.
            </p>
        `;
    }
}

function mostrarProductosDestacados(productos) {
    const productosGrid = document.getElementById(
        'productosDestacadosGrid'
    );

    if (!productosGrid) {
        return;
    }

    if (!Array.isArray(productos) || productos.length === 0) {
        productosGrid.innerHTML = `
            <p>No hay productos destacados disponibles.</p>
        `;

        return;
    }

    productosGrid.innerHTML = productos
        .map((producto) => {
            const nombre = escaparHTML(producto.nombre);
            const categoria = escaparHTML(producto.categoria);
            const presentacion = escaparHTML(
                producto.presentacion || ''
            );
            const imagen = escaparHTML(producto.imagen);
            const precio = formatearPrecio(producto.precio);
            const etiqueta = obtenerEtiquetaProducto(producto);
            const disponibilidad =
                obtenerDisponibilidadProducto(producto);

            return `
                <article class="producto-card">

                    <div class="producto-imagen">

                        ${etiqueta
                    ? `
                                <span class="producto-etiqueta ${etiqueta.clase}">
                                    ${etiqueta.texto}
                                </span>
                            `
                    : ""
                }

                        <img
                            src="${imagen}"
                            alt="${nombre}"
                            loading="lazy"
                        >

                    </div>

                    <div class="producto-contenido">

                        <p class="producto-categoria">
                            ${categoria}
                        </p>

                        <h3>${nombre}</h3>

                        <p class="producto-presentacion">
                            ${presentacion}
                        </p>

                        <div class="producto-info">

                            <span class="producto-precio">
                                ${precio}
                            </span>

                            <span class="producto-disponibilidad ${disponibilidad.clase}">
                                <i class="fa-solid fa-circle-check"></i>
                                ${disponibilidad.texto}
                            </span>

                        </div>

                        <div class="producto-acciones">

                            <button
                                type="button"
                                class="btn-detalle"
                                data-id-producto="${producto.id_producto}"
                            >
                                <i class="fa-regular fa-eye"></i>
                                Ver detalle
                            </button>

                            <a
                                href="${crearEnlaceWhatsapp(producto)}"
                                target="_blank"
                                rel="noopener noreferrer"
                                class="btn-producto-whatsapp"
                                aria-label="Consultar ${nombre} por WhatsApp"
                            >
                                <i class="fa-brands fa-whatsapp"></i>
                            </a>

                        </div>

                    </div>

                </article>
            `;
        })
        .join('');
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
    if (producto.disponible) {
        return {
            texto: "Disponible",
            clase: "disponible"
        };
    }

    return {
        texto: "Agotado",
        clase: "agotado"
    };
}

function configurarBotonesDetalle() {
    const contenedor = document.getElementById(
        'productosDestacadosGrid'
    );

    if (!contenedor) {
        return;
    }

    contenedor.addEventListener('click', (evento) => {
        const boton = evento.target.closest('.btn-detalle');

        if (!boton) {
            return;
        }

        const productoSeleccionado = productosDestacados.find(
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

/* ==========================
   UTILIDADES
========================== */

function crearSlug(texto) {
    return String(texto ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function escaparHTML(texto) {
    const elemento = document.createElement('div');

    elemento.textContent = texto ?? '';

    return elemento.innerHTML;
}

function formatearPrecio(precio) {
    const valor = Number(precio);

    if (!Number.isFinite(valor)) {
        return '₡0';
    }

    return `₡${new Intl.NumberFormat('es-CR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(valor)}`;
}

function crearEnlaceWhatsapp(producto) {
    const nombre = producto.nombre || 'el producto';
    const precio = formatearPrecio(producto.precio);

    const mensaje = `
Hola, me interesa el producto ${nombre}.
Precio: ${precio}.
    `.trim();

    return `https://wa.me/50672497807?text=${encodeURIComponent(mensaje)}`;
}
