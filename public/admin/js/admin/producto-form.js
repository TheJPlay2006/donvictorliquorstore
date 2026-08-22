let productoIdEdicion = null;
let imagenActualUrl = null;
let archivoImagenSeleccionado = null;
let previewBlobUrl = null;

document.addEventListener("admin-listo", async () => {
    const parametros = new URLSearchParams(window.location.search);
    productoIdEdicion = parametros.get("id");

    await cargarCategoriasParaFormulario();

    if (productoIdEdicion) {
        document.getElementById("adminFormTitulo").textContent = "Editar producto";
        await cargarProductoParaEditar(productoIdEdicion);
    }

    configurarFormularioProducto();
});

async function cargarCategoriasParaFormulario() {
    const select = document.getElementById("campoCategoria");

    const { data, error } = await window.supabaseClient
        .from("categorias")
        .select("id_categoria, nombre")
        .order("nombre", { ascending: true });

    if (error) {
        console.error("Error al cargar categorías:", error);
        return;
    }

    data.forEach((categoria) => {
        const opcion = document.createElement("option");
        opcion.value = String(categoria.id_categoria);
        opcion.textContent = categoria.nombre;
        select.appendChild(opcion);
    });
}

async function cargarProductoParaEditar(id) {
    const { data: producto, error } = await window.supabaseClient
        .from("productos")
        .select("*")
        .eq("id_producto", id)
        .single();

    if (error || !producto) {
        console.error("Error al cargar producto:", error);
        document.getElementById("productoFeedback").textContent =
            "No se pudo cargar el producto.";
        return;
    }

    const formulario = document.getElementById("formularioProducto");
    formulario.elements.nombre.value = producto.nombre || "";
    formulario.elements.marca.value = producto.marca || "";
    formulario.elements.codigo.value = producto.codigo || "";
    formulario.elements.presentacion.value = producto.presentacion || "";
    formulario.elements.descripcion.value = producto.descripcion || "";
    formulario.elements.precio.value = producto.precio;
    formulario.elements.stock.value = producto.stock;
    formulario.elements.id_categoria.value = String(producto.id_categoria);
    if (producto.disponible && Number(producto.stock) > 0) {
        formulario.elements.disponibilidad.value = "disponible";
    } else if (Number(producto.stock) <= 0) {
        formulario.elements.disponibilidad.value = "agotado";
    } else {
        formulario.elements.disponibilidad.value = "consultar";
    }
    formulario.elements.destacado.checked = !!producto.destacado;
    formulario.elements.promocion.checked = !!producto.promocion;
    formulario.elements.estado.checked = !!producto.estado;

    imagenActualUrl = producto.imagen || null;
    actualizarVisualizacionImagen();
}

function mostrarErrorImagen(mensaje) {
    const feedback = document.getElementById("dropzoneFeedbackError");
    if (feedback) {
        feedback.textContent = `✕ ${mensaje}`;
        feedback.style.display = "block";
    }
}

function ocultarErrorImagen() {
    const feedback = document.getElementById("dropzoneFeedbackError");
    if (feedback) {
        feedback.textContent = "";
        feedback.style.display = "none";
    }
}

function validarImagenLocal(archivo) {
    const tiposPermitidos = ["image/jpeg", "image/png", "image/webp"];
    const tamanioMaximo = 8 * 1024 * 1024; // 8 MB

    if (!archivo) {
        return "No se seleccionó ningún archivo.";
    }
    if (!tiposPermitidos.includes(archivo.type)) {
        return "El archivo debe ser JPEG, PNG o WebP.";
    }
    if (archivo.size > tamanioMaximo) {
        return "La imagen no puede superar los 8 MB.";
    }
    return null;
}

function actualizarVisualizacionImagen() {
    const vacioDiv = document.getElementById("dropzoneContenidoVacio");
    const previewDiv = document.getElementById("dropzoneContenidoPreview");
    const previewImg = document.getElementById("previewImagen");
    const nombreTexto = document.getElementById("imagenNombreTexto");
    const btnQuitar = document.getElementById("btnQuitarImagen");

    ocultarErrorImagen();

    if (archivoImagenSeleccionado) {
        vacioDiv.hidden = true;
        previewDiv.hidden = false;

        if (previewBlobUrl) {
            URL.revokeObjectURL(previewBlobUrl);
        }
        previewBlobUrl = URL.createObjectURL(archivoImagenSeleccionado);
        previewImg.src = previewBlobUrl;
        nombreTexto.textContent = `✓ Imagen seleccionada: ${archivoImagenSeleccionado.name}`;

        btnQuitar.textContent = imagenActualUrl ? "Cancelar cambio" : "Quitar selección";
        btnQuitar.hidden = false;
    } else if (imagenActualUrl) {
        vacioDiv.hidden = true;
        previewDiv.hidden = false;

        previewImg.src = imagenActualUrl.startsWith("blob:") ? imagenActualUrl : window.resolverRutaImagenAdmin(imagenActualUrl);
        nombreTexto.textContent = "Imagen actual";
        btnQuitar.hidden = true;
    } else {
        vacioDiv.hidden = false;
        previewDiv.hidden = true;
        previewImg.src = "";
        nombreTexto.textContent = "";
        btnQuitar.hidden = true;
    }
}

function handleImageFile(file) {
    const errorMsg = validarImagenLocal(file);
    if (errorMsg) {
        archivoImagenSeleccionado = null;
        document.getElementById("campoImagenArchivo").value = "";
        actualizarVisualizacionImagen();
        mostrarErrorImagen(errorMsg);
        return;
    }

    archivoImagenSeleccionado = file;

    const input = document.getElementById("campoImagenArchivo");
    if (input.files[0] !== file) {
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
    }

    actualizarVisualizacionImagen();
}

function quitarSeleccionImagen() {
    archivoImagenSeleccionado = null;
    document.getElementById("campoImagenArchivo").value = "";
    if (previewBlobUrl) {
        URL.revokeObjectURL(previewBlobUrl);
        previewBlobUrl = null;
    }
    actualizarVisualizacionImagen();
}

function configurarFormularioProducto() {
    const dropzone = document.getElementById("dropzoneImagen");
    const input = document.getElementById("campoImagenArchivo");
    const btnQuitar = document.getElementById("btnQuitarImagen");

    // Click en la dropzone para abrir selector de archivos
    dropzone.addEventListener("click", (evento) => {
        // Ignorar clics en botones de acción del preview
        if (evento.target.closest(".admin-preview-botones")) {
            return;
        }
        if (evento.target === input) {
            return;
        }
        input.click();
    });

    // Accesibilidad por teclado
    dropzone.addEventListener("keydown", (evento) => {
        if (evento.key === "Enter" || evento.key === " ") {
            evento.preventDefault();
            input.click();
        }
    });

    // Evitar parpadeo del estado dragover con un contador
    let dragCounter = 0;

    dropzone.addEventListener("dragenter", (evento) => {
        evento.preventDefault();
        dragCounter++;
        if (dragCounter === 1) {
            dropzone.classList.add("admin-dropzone-activa");
        }
    });

    dropzone.addEventListener("dragover", (evento) => {
        evento.preventDefault();
    });

    dropzone.addEventListener("dragleave", (evento) => {
        evento.preventDefault();
        dragCounter--;
        if (dragCounter === 0) {
            dropzone.classList.remove("admin-dropzone-activa");
        }
    });

    dropzone.addEventListener("drop", (evento) => {
        evento.preventDefault();
        dragCounter = 0;
        dropzone.classList.remove("admin-dropzone-activa");

        const archivos = evento.dataTransfer.files;
        if (archivos && archivos.length > 0) {
            if (archivos.length > 1) {
                mostrarErrorImagen("Solo podés seleccionar una imagen por producto.");
                return;
            }
            handleImageFile(archivos[0]);
        }
    });

    // Evento de cambio en el input de archivo
    input.addEventListener("change", (evento) => {
        const archivo = evento.target.files[0] || null;
        if (archivo) {
            handleImageFile(archivo);
        }
    });

    // Acción de quitar / cancelar cambio de imagen
    if (btnQuitar) {
        btnQuitar.addEventListener("click", (evento) => {
            evento.stopPropagation();
            quitarSeleccionImagen();
        });
    }

    // Pegar imagen desde el portapapeles (Ctrl+V)
    document.addEventListener("paste", (evento) => {
        const activeEl = document.activeElement;
        // No interferir con entradas de texto normales (ej: pegar nombre o descripción)
        if (activeEl && (activeEl.tagName === "INPUT" && activeEl.type !== "file" || activeEl.tagName === "TEXTAREA")) {
            const items = evento.clipboardData && evento.clipboardData.items;
            if (items) {
                for (let i = 0; i < items.length; i++) {
                    if (items[i].type.startsWith("image/")) {
                        const file = items[i].getAsFile();
                        if (file) {
                            evento.preventDefault();
                            handleImageFile(file);
                            break;
                        }
                    }
                }
            }
            return;
        }

        const archivos = evento.clipboardData && evento.clipboardData.files;
        if (archivos && archivos.length > 0) {
            const primerArchivo = archivos[0];
            if (primerArchivo.type.startsWith("image/")) {
                evento.preventDefault();
                handleImageFile(primerArchivo);
            }
        }
    });

    // Inicializar visualización del estado actual de la imagen (vacío o cargado al editar)
    actualizarVisualizacionImagen();

    document.getElementById("formularioProducto").addEventListener("submit", guardarProducto);
}

async function guardarProducto(evento) {
    evento.preventDefault();

    const formulario = evento.target;
    const feedback = document.getElementById("productoFeedback");
    const boton = document.getElementById("botonGuardarProducto");

    feedback.textContent = "";

    if (!formulario.reportValidity()) {
        return;
    }

    if (boton.disabled) {
        return;
    }

    boton.disabled = true;

    try {
        let urlImagenFinal = imagenActualUrl;

        if (archivoImagenSeleccionado) {
            const resultado = await window.subirImagenAdmin(
                "productos",
                archivoImagenSeleccionado,
                formulario.elements.nombre.value
            );
            urlImagenFinal = resultado.url;
        }

        const datosProducto = {
            nombre: formulario.elements.nombre.value.trim(),
            marca: formulario.elements.marca.value.trim() || null,
            codigo: formulario.elements.codigo.value.trim() || null,
            presentacion: formulario.elements.presentacion.value.trim() || null,
            descripcion: formulario.elements.descripcion.value.trim() || null,
            precio: Number(formulario.elements.precio.value),
            id_categoria: Number(formulario.elements.id_categoria.value),
            imagen: urlImagenFinal,
            stock:formulario.elements.disponibilidad.value === "agotado"
                    ? 0
                    : Number(formulario.elements.stock.value),

            disponible:formulario.elements.disponibilidad.value === "disponible",

            destacado: formulario.elements.destacado.checked,
            promocion: formulario.elements.promocion.checked,
            estado: formulario.elements.estado.checked
        };

        let error;

        if (productoIdEdicion) {
            ({ error } = await window.supabaseClient
                .from("productos")
                .update(datosProducto)
                .eq("id_producto", productoIdEdicion));
        } else {
            ({ error } = await window.supabaseClient
                .from("productos")
                .insert(datosProducto));
        }

        if (error) {
            throw error;
        }

        // Solo borrar la imagen anterior después de confirmar que la fila
        // se actualizó correctamente, y solo si cambió a una imagen nueva.
        if (archivoImagenSeleccionado && imagenActualUrl && imagenActualUrl !== urlImagenFinal) {
            await window.eliminarImagenAdminSiEsDeStorage(imagenActualUrl);
        }

        window.location.replace("productos.html");
    } catch (error) {
        console.error("Error al guardar producto:", error);
        feedback.textContent = error.message || "No se pudo guardar el producto.";
        boton.disabled = false;
    }
}
