let productosDestacados = [];
let categoriasInicio = [];

document.addEventListener('DOMContentLoaded', () => {
    cargarCategorias();
    cargarProductosDestacados();
    configurarBotonesDetalle();
    inicializarAuroraHero();
});

window.addEventListener('dv:idioma-cambio', () => {
    mostrarCategorias(categoriasInicio);
    mostrarProductosDestacados(productosDestacados);
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

        categoriasInicio = (data || []).slice(0, 4);

        mostrarCategorias(categoriasInicio);
    } catch (error) {
        console.error('Error al cargar las categorías:', error);

        categoriasGrid.innerHTML = `
            <p class="mensaje-error">
                ${t('producto.errorCategorias')}
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
            <p>${t('producto.sinCategorias')}</p>
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
                            ${t('producto.verProductos')}
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
                imagen, destacado, promocion, disponible, estado, id_categoria, codigo,
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
                ${t('producto.errorProductosDestacados')}
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
            <p>${t('producto.sinProductosDestacados')}</p>
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
                                ${t('producto.verDetalle')}
                            </button>

                            <a
                                href="${crearEnlaceWhatsAppConsulta(producto)}"
                                target="_blank"
                                rel="noopener noreferrer"
                                class="btn-producto-whatsapp"
                                aria-label="${t('producto.consultarAriaPrefijo')} ${nombre} ${t('producto.consultarAriaSufijo')}"
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
            texto: t('producto.promocion'),
            clase: "promocion"
        };
    }

    if (producto.destacado) {
        return {
            texto: t('producto.destacado'),
            clase: "destacado"
        };
    }

    return null;
}

function obtenerDisponibilidadProducto(producto) {
    if (producto.disponible) {
        return {
            texto: t('producto.disponible'),
            clase: "disponible"
        };
    }

    return {
        texto: t('producto.agotado'),
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

/* ==========================
   AURORA DEL HERO (solo home)
   Adaptado de un "Aurora Background" de 21st.dev: blobs de gradiente
   radial en <canvas>, mezclados con "screen", moviéndose en órbitas
   sinusoidales lentas. Paleta ajustada a los colores de la marca (ámbar +
   vino) en vez del preset original. Se pausa fuera de vista y se
   desactiva por completo con prefers-reduced-motion.
========================== */

function inicializarAuroraHero() {
    const canvas = document.querySelector('.inicio-hero-aurora');

    if (!canvas || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
    }

    const contexto = canvas.getContext('2d');

    if (!contexto) {
        return;
    }

    const capas = [
        ['hsla(28, 92%, 55%, .5)', 'hsla(350, 65%, 32%, .35)', 'transparent'],
        ['hsla(45, 90%, 62%, .4)', 'transparent', 'transparent'],
        ['hsla(6, 70%, 42%, .35)', 'transparent', 'transparent']
    ];

    let tiempo = 0;
    let animando = false;
    let cuadroProgramado = null;

    const ajustarTamano = () => {
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
    };

    const dibujar = () => {
        tiempo += 0.006;

        const ancho = canvas.width;
        const alto = canvas.height;

        contexto.clearRect(0, 0, ancho, alto);
        contexto.globalCompositeOperation = 'screen';

        capas.forEach((capa, indice) => {
            const fase = (indice / capas.length) * Math.PI * 2 + tiempo;
            const x = ancho / 2 + Math.sin(fase) * (ancho * 0.28) + Math.cos(tiempo * 0.4) * (ancho * 0.08);
            const y = alto / 2 + Math.cos(fase * 0.7) * (alto * 0.3) + Math.sin(tiempo * 0.25) * (alto * 0.08);

            const gradiente = contexto.createRadialGradient(x, y, 0, x, y, Math.max(ancho, alto) * 0.42);
            gradiente.addColorStop(0, capa[0]);
            gradiente.addColorStop(0.5, capa[1]);
            gradiente.addColorStop(1, capa[2]);

            contexto.fillStyle = gradiente;
            contexto.fillRect(0, 0, ancho, alto);
        });

        contexto.globalCompositeOperation = 'source-over';

        if (animando) {
            cuadroProgramado = requestAnimationFrame(dibujar);
        }
    };

    const iniciar = () => {
        if (animando) {
            return;
        }

        animando = true;
        cuadroProgramado = requestAnimationFrame(dibujar);
    };

    const detener = () => {
        animando = false;

        if (cuadroProgramado) {
            cancelAnimationFrame(cuadroProgramado);
            cuadroProgramado = null;
        }
    };

    ajustarTamano();
    window.addEventListener('resize', ajustarTamano);

    if ('IntersectionObserver' in window) {
        const observador = new IntersectionObserver(
            (entradas) => {
                entradas.forEach((entrada) => {
                    if (entrada.isIntersecting) {
                        iniciar();
                    } else {
                        detener();
                    }
                });
            },
            { threshold: 0.05 }
        );

        observador.observe(canvas);
    } else {
        iniciar();
    }
}
