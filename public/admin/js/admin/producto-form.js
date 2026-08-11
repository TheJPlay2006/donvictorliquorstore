let productoIdEdicion = null;
let imagenActualUrl = null;
let archivoImagenSeleccionado = null;

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
    formulario.elements.disponible.checked = !!producto.disponible;
    formulario.elements.destacado.checked = !!producto.destacado;
    formulario.elements.promocion.checked = !!producto.promocion;
    formulario.elements.estado.checked = !!producto.estado;

    imagenActualUrl = producto.imagen || null;
    mostrarPreviewImagen(imagenActualUrl);
}

function mostrarPreviewImagen(url) {
    const img = document.getElementById("previewImagen");
    const texto = document.getElementById("imagenActualTexto");

    if (url) {
        img.src = url.startsWith("blob:") ? url : window.resolverRutaImagenAdmin(url);
        img.hidden = false;
        texto.textContent = "Imagen actual";
    } else {
        img.hidden = true;
        texto.textContent = "Sin imagen todavía.";
    }
}

function configurarFormularioProducto() {
    document.getElementById("campoImagenArchivo").addEventListener("change", (evento) => {
        const archivo = evento.target.files[0] || null;
        archivoImagenSeleccionado = archivo;

        if (archivo) {
            mostrarPreviewImagen(URL.createObjectURL(archivo));
            document.getElementById("imagenActualTexto").textContent = archivo.name;
        }
    });

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
            stock: Number(formulario.elements.stock.value),
            id_categoria: Number(formulario.elements.id_categoria.value),
            imagen: urlImagenFinal,
            disponible: formulario.elements.disponible.checked,
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
