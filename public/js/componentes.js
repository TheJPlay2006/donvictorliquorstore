document.addEventListener("DOMContentLoaded", async () => {
    await cargarComponente("header-container", "components/header.html");
    await cargarComponente("footer-container", "components/footer.html");

    marcarPaginaActiva();
    mostrarAnioActual();
    inicializarMenuMovil();
    inicializarFormularioContacto();
    animarEntradaDeSecciones();
    animarElementosGranulares();
    inicializarAcordeones();
    inicializarAvisoCookies();
    window.dvInicializarIdioma?.();
    inicializarAnuncioSuperior();
});

function inicializarMenuMovil() {
    const botonAbrir = document.querySelector(".menu-toggle");
    const botonCerrar = document.querySelector(".menu-cerrar");
    const fondo = document.querySelector(".menu-fondo");
    const menu = document.getElementById("menuPrincipal");

    if (!botonAbrir || !menu) {
        return;
    }

    const actualizarMenuInerte = (inactivo) => {
        menu.toggleAttribute("inert", inactivo);
    };

    actualizarMenuInerte(window.innerWidth < 992);

    const cerrarMenu = () => {
        document.body.classList.remove("menu-abierto");
        botonAbrir.setAttribute("aria-expanded", "false");
        actualizarMenuInerte(window.innerWidth < 992);
    };

    const abrirMenu = () => {
        actualizarMenuInerte(false);
        document.body.classList.add("menu-abierto");
        botonAbrir.setAttribute("aria-expanded", "true");
        botonCerrar?.focus();
    };

    botonAbrir.addEventListener("click", () => {
        if (document.body.classList.contains("menu-abierto")) {
            cerrarMenu();
        } else {
            abrirMenu();
        }
    });

    botonCerrar?.addEventListener("click", cerrarMenu);
    fondo?.addEventListener("click", cerrarMenu);
    menu.addEventListener("click", (evento) => {
        if (evento.target.closest("a")) {
            cerrarMenu();
        }
    });

    document.addEventListener("keydown", (evento) => {
        if (evento.key === "Escape") {
            cerrarMenu();
        }
    });

    window.addEventListener("resize", () => {
        if (window.innerWidth >= 992) {
            cerrarMenu();
            actualizarMenuInerte(false);
        } else if (!document.body.classList.contains("menu-abierto")) {
            actualizarMenuInerte(true);
        }
    });
}

function animarEntradaDeSecciones() {
    // Una sección que ya contiene elementos [data-reveal] no debe además
    // recibir su propio fade de .reveal-seccion: las opacidades se
    // multiplican (0.5 × 0.5 = 0.25) y la sección queda visualmente
    // "apagada" mucho más tiempo del previsto.
    const secciones = Array.from(
        document.querySelectorAll("#mainContent > section")
    ).filter((seccion) => !seccion.querySelector("[data-reveal]"));

    if (!secciones.length) {
        return;
    }

    if (
        window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
        !("IntersectionObserver" in window)
    ) {
        return;
    }

    const observer = new IntersectionObserver(
        (entradas, obs) => {
            entradas.forEach((entrada) => {
                if (entrada.isIntersecting) {
                    entrada.target.classList.add("en-vista");
                    obs.unobserve(entrada.target);
                }
            });
        },
        { threshold: 0.12 }
    );

    secciones.forEach((seccion) => {
        seccion.classList.add("reveal-seccion");
        observer.observe(seccion);
    });

    // Red de seguridad: si por lo que sea alguna sección nunca "entra en
    // vista" (ej. queda oculta detrás de otro contenido), no debe quedar
    // invisible para siempre.
    setTimeout(() => {
        secciones.forEach((seccion) => seccion.classList.add("en-vista"));
    }, 1500);
}

// Revelado granular por elemento vía [data-reveal] (dirección opcional:
// left/right/up/scale) y [data-reveal-delay] (ms). Observer independiente
// del de animarEntradaDeSecciones: no reutiliza sus elementos ni su
// instancia, así que ambos pueden convivir sin observar dos veces lo mismo.
function animarElementosGranulares() {
    const elementos = document.querySelectorAll("[data-reveal]");

    if (!elementos.length) {
        return;
    }

    elementos.forEach((elemento) => {
        const retraso = elemento.getAttribute("data-reveal-delay");

        if (retraso) {
            elemento.style.setProperty("--reveal-delay", `${retraso}ms`);
        }
    });

    if (
        window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
        !("IntersectionObserver" in window)
    ) {
        elementos.forEach((elemento) => elemento.classList.add("en-vista"));
        return;
    }

    const observer = new IntersectionObserver(
        (entradas, obs) => {
            entradas.forEach((entrada) => {
                if (entrada.isIntersecting) {
                    entrada.target.classList.add("en-vista");
                    obs.unobserve(entrada.target);
                }
            });
        },
        { threshold: 0.15 }
    );

    elementos.forEach((elemento) => observer.observe(elemento));

    setTimeout(() => {
        elementos.forEach((elemento) => elemento.classList.add("en-vista"));
    }, 1500);
}

// Acordeón accesible mínimo para bloques [data-acordeon]: cada pregunta es
// un <button aria-expanded> que muestra/oculta su respuesta con el
// atributo `hidden`. No depende del bundle de Bootstrap.
function inicializarAcordeones() {
    const acordeones = document.querySelectorAll("[data-acordeon]");

    acordeones.forEach((acordeon) => {
        const preguntas = acordeon.querySelectorAll(".faq-pregunta");

        preguntas.forEach((boton) => {
            boton.addEventListener("click", () => {
                const expandido = boton.getAttribute("aria-expanded") === "true";
                const respuesta = document.getElementById(
                    boton.getAttribute("aria-controls")
                );

                boton.setAttribute("aria-expanded", String(!expandido));

                if (respuesta) {
                    respuesta.hidden = expandido;
                }
            });
        });
    });
}

async function cargarComponente(contenedorId, archivo) {
    const contenedor = document.getElementById(contenedorId);

    if (!contenedor) {
        return;
    }

    try {
        const respuesta = await fetch(archivo);

        if (!respuesta.ok) {
            throw new Error(`No se pudo cargar ${archivo}`);
        }

        contenedor.innerHTML = await respuesta.text();
    } catch (error) {
        console.error("Error al cargar el componente:", error);
    }
}

function marcarPaginaActiva() {
    const paginaActual =
        window.location.pathname.split("/").pop() || "index.html";
    const enlacesMenu = document.querySelectorAll(".menu a");

    enlacesMenu.forEach((enlace) => {
        if (enlace.getAttribute("href") === paginaActual) {
            enlace.classList.add("active");
            enlace.setAttribute("aria-current", "page");
        }
    });
}

function mostrarAnioActual() {
    const anio = new Date().getFullYear();
    const anioActual = document.getElementById("anioActual");

    if (anioActual) {
        anioActual.textContent = anio;
    }

    document
        .querySelectorAll(".anioActualExtra")
        .forEach((elemento) => {
            elemento.textContent = anio;
        });
}

const DV_ANUNCIO_CLAVE_CERRADO = "dv_anuncio_cerrado";

function inicializarAnuncioSuperior() {
    const anuncio = document.getElementById("anuncioSuperior");

    if (!anuncio) {
        return;
    }

    let cerradoPreviamente = false;

    try {
        cerradoPreviamente =
            window.localStorage.getItem(DV_ANUNCIO_CLAVE_CERRADO) === "true";
    } catch (error) {
        cerradoPreviamente = false;
    }

    if (cerradoPreviamente) {
        anuncio.remove();
        return;
    }

    const botonCerrar = anuncio.querySelector(".anuncio-superior-cerrar");

    botonCerrar?.addEventListener("click", () => {
        anuncio.classList.add("anuncio-superior-saliendo");

        try {
            window.localStorage.setItem(DV_ANUNCIO_CLAVE_CERRADO, "true");
        } catch (error) {
            // Almacenamiento no disponible: el anuncio solo se ocultará en esta vista.
        }

        setTimeout(() => anuncio.remove(), 320);
    });
}

const DV_COOKIES_CLAVE = "dv_cookies_aceptadas";

// El aviso de cookies se genera por JS (no vive en header/footer.html) para
// que aparezca en TODAS las páginas con una sola fuente de verdad. Se crea
// antes de dvInicializarIdioma() para que su primer pase de traducción ya
// lo cubra.
function inicializarAvisoCookies() {
    if (document.getElementById("avisoCookies")) {
        return;
    }

    let aceptadas = false;

    try {
        aceptadas = window.localStorage.getItem(DV_COOKIES_CLAVE) === "true";
    } catch (error) {
        aceptadas = false;
    }

    if (aceptadas) {
        return;
    }

    const aviso = document.createElement("div");

    aviso.id = "avisoCookies";
    aviso.className = "aviso-cookies";
    aviso.setAttribute("role", "region");
    aviso.setAttribute("aria-label", "Cookies");

    aviso.innerHTML = `
        <div class="aviso-cookies-interior">
            <p>
                <i class="fa-solid fa-cookie-bite" aria-hidden="true"></i>
                <span data-i18n="cookies.aviso">Usamos almacenamiento local del navegador para recordar tu idioma y mejorar tu experiencia.</span>
                <a href="cookies.html" data-i18n="cookies.masInfo">Más información</a>
            </p>
            <button type="button" class="aviso-cookies-aceptar" data-i18n="cookies.aceptar">Aceptar</button>
        </div>
    `;

    document.body.appendChild(aviso);

    aviso.querySelector(".aviso-cookies-aceptar")?.addEventListener("click", () => {
        try {
            window.localStorage.setItem(DV_COOKIES_CLAVE, "true");
        } catch (error) {
            // Sin almacenamiento disponible: el aviso volverá a aparecer en la próxima visita.
        }

        aviso.classList.add("aviso-cookies-saliendo");
        setTimeout(() => aviso.remove(), 320);
    });
}

/* ==========================
   CONSULTA DE PRODUCTOS POR WHATSAPP
   Compartido por catalogo.js, categorias.js, inicio.js y modal-producto.js
   (componentes.js se carga antes que todos ellos en cada página).
========================== */

// Siempre apunta a catalogo.html: es la única página que carga el catálogo
// completo, así que el deep link funciona sin importar desde qué página
// (inicio, categorías) se generó el mensaje.
function crearEnlaceProducto(idProducto) {
    return new URL(
        `catalogo.html?producto=${idProducto}`,
        window.location.href
    ).href;
}

function crearMensajeConsultaWhatsApp(producto) {
    const lineas = [
        `Hola, deseo consultar por el producto ${producto.nombre}.`
    ];

    if (producto.codigo) {
        lineas.push(`Código: ${producto.codigo}`);
    }

    lineas.push(`Enlace: ${crearEnlaceProducto(producto.id_producto)}`);

    return lineas.join("\n");
}

function crearEnlaceWhatsAppConsulta(producto) {
    return `https://wa.me/50672497807?text=${encodeURIComponent(
        crearMensajeConsultaWhatsApp(producto)
    )}`;
}

function inicializarFormularioContacto() {
    const formularios = document.querySelectorAll("[data-whatsapp-form]");

    formularios.forEach((formulario) => {
        formulario.addEventListener("submit", (event) => {
            event.preventDefault();

            if (!formulario.reportValidity()) {
                return;
            }

            const nombre = formulario.elements.name.value.trim();
            const telefono = formulario.elements.phone.value.trim();
            const consulta = formulario.elements.message.value.trim();
            const mensaje = [
                "Hola, deseo realizar una consulta.",
                `Nombre: ${nombre}`,
                `Teléfono: ${telefono}`,
                `Mensaje: ${consulta}`,
            ].join("\n");
            const enlace =
                `https://wa.me/50672497807?text=${encodeURIComponent(mensaje)}`;
            const feedback = formulario.querySelector(".consulta-feedback");
            const boton = formulario.querySelector("button[type='submit']");
            const textoBotonOriginal = boton ? boton.innerHTML : "";

            if (boton) {
                boton.setAttribute("data-enviando", "true");
                boton.disabled = true;
                boton.innerHTML =
                    '<i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i> Abriendo WhatsApp…';
            }

            if (feedback) {
                feedback.textContent =
                    "Tu consulta está lista. Abrimos WhatsApp en una nueva pestaña.";
                feedback.setAttribute("role", "status");
            }

            window.open(enlace, "_blank", "noopener,noreferrer");

            if (boton) {
                setTimeout(() => {
                    boton.removeAttribute("data-enviando");
                    boton.disabled = false;
                    boton.innerHTML = textoBotonOriginal;
                }, 900);
            }
        });
    });
}
