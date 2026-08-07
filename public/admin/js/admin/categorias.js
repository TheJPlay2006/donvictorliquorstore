const PLACEHOLDER_IMAGEN_CATEGORIA_ADMIN =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' fill='%232B1A16'/%3E%3Cpath d='M24 14h16v6l4 4v26a2 2 0 0 1-2 2H22a2 2 0 0 1-2-2V24l4-4z' fill='none' stroke='%23B6AAA3' stroke-width='2'/%3E%3C/svg%3E";

let categoriasAdminLista = [];
let categoriaEditandoId = null;
let categoriaImagenActualUrl = null;
let categoriaArchivoSeleccionado = null;

document.addEventListener("admin-listo", () => {
    cargarCategoriasAdmin();
    configurarPanelCategoria();
});

async function cargarCategoriasAdmin() {
    const contenedor = document.getElementById("adminListaCategorias");

    const { data, error } = await window.supabaseClient
        .from("categorias")
        .select("*")
        .order("nombre", { ascending: true });

    if (error) {
        console.error("Error al cargar categorías (admin):", error);
        contenedor.innerHTML = `<p class="admin-mensaje-error">No fue posible cargar las categorías.</p>`;
        return;
    }

    categoriasAdminLista = data;
    renderizarCategoriasAdmin();
}

function renderizarCategoriasAdmin() {
    const contenedor = document.getElementById("adminListaCategorias");

    if (categoriasAdminLista.length === 0) {
        contenedor.innerHTML = `<p class="admin-mensaje-vacio">Todavía no hay categorías.</p>`;
        return;
    }

    contenedor.innerHTML = "";

    categoriasAdminLista.forEach((categoria) => {
        contenedor.appendChild(crearFilaCategoriaAdmin(categoria));
    });
}

function crearFilaCategoriaAdmin(categoria) {
    const fila = document.createElement("article");
    fila.className = "admin-fila";

    const descripcionCorta = categoria.descripcion
        ? categoria.descripcion.slice(0, 90) + (categoria.descripcion.length > 90 ? "…" : "")
        : "Sin descripción";

    fila.innerHTML = `
        <img class="admin-fila-miniatura" src="${escaparAtributoCategoriaAdmin(window.resolverRutaImagenAdmin(categoria.imagen) || PLACEHOLDER_IMAGEN_CATEGORIA_ADMIN)}" alt="" loading="lazy" onerror="this.onerror=null;this.src='${PLACEHOLDER_IMAGEN_CATEGORIA_ADMIN}';">

        <div class="admin-fila-info">
            <strong>${escaparTextoCategoriaAdmin(categoria.nombre)}</strong>
            <span>${escaparTextoCategoriaAdmin(descripcionCorta)}</span>
        </div>

        <div class="admin-fila-badges">
            <button type="button" class="admin-badge-toggle ${categoria.mostrar_inicio ? "activo" : ""}" data-campo="mostrar_inicio">En inicio</button>
            <button type="button" class="admin-badge-toggle admin-badge-estado ${categoria.estado ? "activo" : ""}" data-campo="estado">${categoria.estado ? "Activa" : "Desactivada"}</button>
        </div>

        <button type="button" class="admin-boton-secundario admin-editar-categoria">
            <i class="fa-solid fa-pen" aria-hidden="true"></i>
            Editar
        </button>
    `;

    fila.querySelectorAll(".admin-badge-toggle").forEach((boton) => {
        boton.addEventListener("click", () => {
            togglearCampoCategoriaAdmin(categoria, boton.dataset.campo, boton);
        });
    });

    fila.querySelector(".admin-editar-categoria").addEventListener("click", () => {
        abrirPanelCategoria(categoria);
    });

    return fila;
}

async function togglearCampoCategoriaAdmin(categoria, campo, boton) {
    const valorAnterior = categoria[campo];
    const valorNuevo = !valorAnterior;

    categoria[campo] = valorNuevo;
    boton.classList.toggle("activo", valorNuevo);

    if (campo === "estado") {
        boton.textContent = valorNuevo ? "Activa" : "Desactivada";
    }

    const { error } = await window.supabaseClient
        .from("categorias")
        .update({ [campo]: valorNuevo })
        .eq("id_categoria", categoria.id_categoria);

    if (error) {
        console.error("Error al actualizar categoría:", error);
        categoria[campo] = valorAnterior;
        boton.classList.toggle("activo", valorAnterior);
        if (campo === "estado") {
            boton.textContent = valorAnterior ? "Activa" : "Desactivada";
        }
        alert("No se pudo guardar el cambio. Intentá de nuevo.");
    }
}

function configurarPanelCategoria() {
    document.getElementById("adminNuevaCategoria").addEventListener("click", () => {
        abrirPanelCategoria(null);
    });

    document.getElementById("botonCancelarCategoria").addEventListener("click", cerrarPanelCategoria);

    document.getElementById("categoriaImagenArchivo").addEventListener("change", (evento) => {
        const archivo = evento.target.files[0] || null;
        categoriaArchivoSeleccionado = archivo;

        if (archivo) {
            mostrarPreviewImagenCategoria(URL.createObjectURL(archivo));
            document.getElementById("imagenActualTextoCategoria").textContent = archivo.name;
        }
    });

    document.getElementById("formularioCategoria").addEventListener("submit", guardarCategoriaAdmin);
}

function abrirPanelCategoria(categoria) {
    const panel = document.getElementById("panelFormCategoria");
    const formulario = document.getElementById("formularioCategoria");
    const titulo = document.getElementById("tituloFormCategoria");

    formulario.reset();
    document.getElementById("categoriaFeedback").textContent = "";
    categoriaArchivoSeleccionado = null;

    if (categoria) {
        categoriaEditandoId = categoria.id_categoria;
        categoriaImagenActualUrl = categoria.imagen || null;
        titulo.textContent = "Editar categoría";
        formulario.elements.nombre.value = categoria.nombre || "";
        formulario.elements.descripcion.value = categoria.descripcion || "";
        formulario.elements.mostrar_inicio.checked = !!categoria.mostrar_inicio;
        formulario.elements.estado.checked = !!categoria.estado;
        mostrarPreviewImagenCategoria(categoriaImagenActualUrl);
    } else {
        categoriaEditandoId = null;
        categoriaImagenActualUrl = null;
        titulo.textContent = "Nueva categoría";
        formulario.elements.estado.checked = true;
        mostrarPreviewImagenCategoria(null);
    }

    panel.hidden = false;
    formulario.elements.nombre.focus();
}

function cerrarPanelCategoria() {
    document.getElementById("panelFormCategoria").hidden = true;
    categoriaEditandoId = null;
    categoriaArchivoSeleccionado = null;
}

function mostrarPreviewImagenCategoria(url) {
    const img = document.getElementById("previewImagenCategoria");
    const texto = document.getElementById("imagenActualTextoCategoria");

    if (url) {
        img.src = url.startsWith("blob:") ? url : window.resolverRutaImagenAdmin(url);
        img.hidden = false;
        texto.textContent = "Imagen actual";
    } else {
        img.hidden = true;
        texto.textContent = "Sin imagen todavía.";
    }
}

async function guardarCategoriaAdmin(evento) {
    evento.preventDefault();

    const formulario = evento.target;
    const feedback = document.getElementById("categoriaFeedback");
    const boton = document.getElementById("botonGuardarCategoria");

    feedback.textContent = "";

    if (!formulario.reportValidity()) {
        return;
    }

    if (boton.disabled) {
        return;
    }

    boton.disabled = true;

    try {
        let urlImagenFinal = categoriaImagenActualUrl;

        if (categoriaArchivoSeleccionado) {
            const resultado = await window.subirImagenAdmin(
                "categorias",
                categoriaArchivoSeleccionado,
                formulario.elements.nombre.value
            );
            urlImagenFinal = resultado.url;
        }

        const datosCategoria = {
            nombre: formulario.elements.nombre.value.trim(),
            descripcion: formulario.elements.descripcion.value.trim() || null,
            imagen: urlImagenFinal,
            mostrar_inicio: formulario.elements.mostrar_inicio.checked,
            estado: formulario.elements.estado.checked
        };

        let error;

        if (categoriaEditandoId) {
            ({ error } = await window.supabaseClient
                .from("categorias")
                .update(datosCategoria)
                .eq("id_categoria", categoriaEditandoId));
        } else {
            ({ error } = await window.supabaseClient
                .from("categorias")
                .insert(datosCategoria));
        }

        if (error) {
            if (error.code === "23505") {
                feedback.textContent = "Ya existe una categoría con ese nombre.";
            } else {
                throw error;
            }
            boton.disabled = false;
            return;
        }

        if (categoriaArchivoSeleccionado && categoriaImagenActualUrl && categoriaImagenActualUrl !== urlImagenFinal) {
            await window.eliminarImagenAdminSiEsDeStorage(categoriaImagenActualUrl);
        }

        cerrarPanelCategoria();
        await cargarCategoriasAdmin();
    } catch (error) {
        console.error("Error al guardar categoría:", error);
        feedback.textContent = error.message || "No se pudo guardar la categoría.";
    } finally {
        boton.disabled = false;
    }
}

function escaparTextoCategoriaAdmin(texto) {
    const contenedor = document.createElement("div");
    contenedor.textContent = texto == null ? "" : String(texto);
    return contenedor.innerHTML;
}

function escaparAtributoCategoriaAdmin(texto) {
    return escaparTextoCategoriaAdmin(texto).replace(/"/g, "&quot;");
}
