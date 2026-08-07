document.addEventListener("DOMContentLoaded", async () => {
    await cargarComponente("header-container", "components/header.html");
    await cargarComponente("footer-container", "components/footer.html");

    marcarPaginaActiva();
    mostrarAnioActual();
    inicializarFormularioContacto();
    animarEntradaDeSecciones();
    animarElementosGranulares();
    inicializarAcordeones();
});

function animarEntradaDeSecciones() {
    const secciones = document.querySelectorAll("#mainContent > section");

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
    }, 4000);
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
    }, 4000);
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
    const anioActual = document.getElementById("anioActual");

    if (anioActual) {
        anioActual.textContent = new Date().getFullYear();
    }
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
