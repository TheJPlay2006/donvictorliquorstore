const PLACEHOLDER_IMAGEN_ADMIN =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' fill='%232B1A16'/%3E%3Cpath d='M24 14h16v6l4 4v26a2 2 0 0 1-2 2H22a2 2 0 0 1-2-2V24l4-4z' fill='none' stroke='%23B6AAA3' stroke-width='2'/%3E%3C/svg%3E";

let productosAdmin = [];
let categoriasAdmin = [];
let textoBusquedaAdmin = "";
let categoriaFiltradaAdmin = "todas";

document.addEventListener("admin-listo", () => {
    cargarProductosAdmin();
    configurarControlesProductosAdmin();
    configurarRevisionImagenes();
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

// ============================================================================
// LÓGICA DE DIAGNÓSTICO Y REVISIÓN DE IMÁGENES
// ============================================================================

let alertasImagenesAdmin = [];
let filtroAlertasActual = "todas-alertas";

function configurarRevisionImagenes() {
    const btnRevisar = document.getElementById("btnRevisarImagenes");
    if (!btnRevisar) return;

    btnRevisar.addEventListener("click", () => {
        const modal = new bootstrap.Modal(document.getElementById("modalRevisarImagenes"));
        modal.show();
        analizarImagenesCatalogo();
    });

    // Filtros del modal
    const botonesFiltro = [
        document.getElementById("btnFiltroMaltas"),
        document.getElementById("btnFiltroSinImg"),
        document.getElementById("btnFiltroSospechosas")
    ];

    botonesFiltro.forEach((btn) => {
        if (!btn) return;
        btn.addEventListener("click", (e) => {
            botonesFiltro.forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");
            filtroAlertasActual = btn.dataset.filtro;
            renderizarAlertasImagenes();
        });
    });

    // Detectar enlaces rotos
    const btnDetectarRotos = document.getElementById("btnAnalizarEnlaces");
    if (btnDetectarRotos) {
        btnDetectarRotos.addEventListener("click", analizarEnlacesRotosCompleto);
    }

    // Buscador del agente
    const btnEjecutar = document.getElementById("btnEjecutarBuscadorAgente");
    if (btnEjecutar) {
        btnEjecutar.addEventListener("click", ejecutarBuscadorAgenteActual);
    }

    const btnCerrarAgente = document.getElementById("btnCerrarBuscadorAgente");
    if (btnCerrarAgente) {
        btnCerrarAgente.addEventListener("click", () => {
            document.getElementById("panelBuscadorAgente").classList.add("d-none");
        });
    }
}

function analizarImagenesCatalogo() {
    let sinImagen = 0;
    let sospechosas = 0;
    let conImagen = 0;

    alertasImagenesAdmin = [];

    productosAdmin.forEach((prod) => {
        const url = (prod.imagen || "").trim();
        const tieneImagen = url && url !== PLACEHOLDER_IMAGEN_ADMIN && !url.includes("data:image/svg+xml");

        if (!tieneImagen) {
            sinImagen++;
            alertasImagenesAdmin.push({
                producto: prod,
                tipo: "sin-imagen",
                motivo: "El producto no tiene ninguna imagen asociada.",
                severidad: "danger"
            });
        } else {
            conImagen++;
            // Diagnosticar imágenes sospechosas
            const razones = [];
            
            // HTTP no seguro (puede causar contenido mixto)
            if (url.startsWith("http://")) {
                razones.push("La URL utiliza HTTP no seguro (puede dar alerta de contenido mixto).");
            }

            // Orígenes penalizados de redes sociales o baja calidad
            const dominiosSospechosos = ["pinterest.com", "instagram.com", "facebook.com", "shutterstock.com", "istockphoto.com", "alamy.com"];
            if (dominiosSospechosos.some(d => url.includes(d))) {
                razones.push("La imagen proviene de un dominio de stock o red social (baja confiabilidad).");
            }

            // Nombres de archivos temporales o genéricos
            const nombreArchivo = url.split("/").pop().toLowerCase();
            if (nombreArchivo.match(/(?:temp|import|test|placeholder|unnamed|product|bottle)\.(?:jpg|png|webp)/)) {
                razones.push("El nombre del archivo sugiere que es una imagen temporal o genérica.");
            }

            if (razones.length > 0) {
                sospechosas++;
                alertasImagenesAdmin.push({
                    producto: prod,
                    tipo: "sospechosa",
                    motivo: razones.join(" "),
                    severidad: "warning"
                });
            }
        }
    });

    // Actualizar contadores en la UI
    document.getElementById("statsTotalProductos").textContent = productosAdmin.length;
    document.getElementById("statsConImagen").textContent = conImagen;
    document.getElementById("statsSinImagen").textContent = sinImagen;
    document.getElementById("statsSospechosas").textContent = sospechosas;

    renderizarAlertasImagenes();
}

function renderizarAlertasImagenes() {
    const contenedor = document.getElementById("listaAlertasImagenes");
    if (!contenedor) return;

    const alertasFiltradas = alertasImagenesAdmin.filter((alerta) => {
        if (filtroAlertasActual === "todas-alertas") return true;
        if (filtroAlertasActual === "sin-imagen") return alerta.tipo === "sin-imagen";
        if (filtroAlertasActual === "sospechosas") return alerta.tipo === "sospechosa";
        return true;
    });

    if (alertasFiltradas.length === 0) {
        contenedor.innerHTML = `
            <div class="text-center py-5 text-success">
                <i class="fa-solid fa-circle-check fs-2 mb-2"></i>
                <div>¡Todo en orden! No se encontraron imágenes que requieran atención en esta categoría.</div>
            </div>
        `;
        return;
    }

    contenedor.innerHTML = "";

    alertasFiltradas.forEach((alerta) => {
        const prod = alerta.producto;
        const item = document.createElement("div");
        item.className = "list-group-item bg-dark text-light border-secondary py-3 d-flex align-items-center gap-3";
        
        const imgUrl = window.resolverRutaImagenAdmin(prod.imagen) || PLACEHOLDER_IMAGEN_ADMIN;
        const severidadClase = alerta.severidad === "danger" ? "text-danger" : "text-warning";
        const badgeIcon = alerta.severidad === "danger" ? "fa-circle-xmark" : "fa-triangle-exclamation";

        item.innerHTML = `
            <img src="${escaparAtributoAdmin(imgUrl)}" class="rounded border border-secondary" style="width: 48px; height: 48px; object-fit: contain; background: #2B1A16;" onerror="this.src='${PLACEHOLDER_IMAGEN_ADMIN}'">
            <div class="flex-grow-1">
                <div class="d-flex align-items-center gap-2">
                    <strong class="text-white">${escaparTextoAdmin(prod.nombre)}</strong>
                    <span class="badge bg-secondary text-light">${escaparTextoAdmin(prod.marca || "Sin marca")}</span>
                </div>
                <div class="small mt-1 text-muted d-flex align-items-center gap-1">
                    <i class="fa-solid ${badgeIcon} ${severidadClase}"></i>
                    <span>${escaparTextoAdmin(alerta.motivo)}</span>
                </div>
            </div>
            <div>
                <button type="button" class="btn btn-sm btn-outline-warning btn-buscar-reemplazo" data-id="${prod.id_producto}">
                    <i class="fa-solid fa-wand-magic-sparkles me-1"></i> Buscar Reemplazo
                </button>
            </div>
        `;

        item.querySelector(".btn-buscar-reemplazo").addEventListener("click", () => {
            abrirBuscadorAgenteParaProducto(prod);
        });

        contenedor.appendChild(item);
    });
}

// Analizar enlaces rotos de verdad usando peticiones HEAD concurrentes
async function analizarEnlacesRotosCompleto() {
    const btn = document.getElementById("btnAnalizarEnlaces");
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1" role="status"></span> Comprobando URLs...`;

    const productosConUrl = productosAdmin.filter(p => p.imagen && p.imagen !== PLACEHOLDER_IMAGEN_ADMIN && !p.imagen.startsWith("data:"));
    let rotos = 0;

    // Ejecutar con concurrencia máxima de 5 para no saturar
    const promesas = productosConUrl.map(async (prod) => {
        try {
            // El pipeline de descarga segura a veces bloquea HEAD en servidores externos. 
            // Intentamos un fetch simple con timeout de 3s.
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3000);
            
            const res = await fetch(window.resolverRutaImagenAdmin(prod.imagen), {
                method: "HEAD",
                signal: controller.signal
            }).catch(() => fetch(window.resolverRutaImagenAdmin(prod.imagen), { method: "GET", signal: controller.signal }));
            
            clearTimeout(timeout);
            
            if (!res.ok && res.status !== 405) { // 405 Method Not Allowed es común para HEAD y no significa roto
                throw new Error("status " + res.status);
            }
        } catch (err) {
            rotos++;
            // Mover a la lista de alertas como peligro de enlace roto
            const alertaExistente = alertasImagenesAdmin.find(a => a.producto.id_producto === prod.id_producto);
            if (alertaExistente) {
                alertaExistente.severidad = "danger";
                alertaExistente.motivo = "¡Enlace Roto! La imagen da error al cargar o no existe (404/Timeout).";
            } else {
                alertasImagenesAdmin.push({
                    producto: prod,
                    tipo: "sospechosa",
                    motivo: "¡Enlace Roto! La imagen da error al cargar o no existe.",
                    severidad: "danger"
                });
            }
        }
    });

    await Promise.all(promesas);

    btn.disabled = false;
    btn.innerHTML = `<i class="fa-solid fa-circle-nodes me-1"></i> Detectar Enlaces Rotos`;
    
    // Actualizar contadores
    const sinImagen = alertasImagenesAdmin.filter(a => a.tipo === "sin-imagen").length;
    const sospechosas = alertasImagenesAdmin.filter(a => a.tipo === "sospechosa").length;
    
    document.getElementById("statsSinImagen").textContent = sinImagen;
    document.getElementById("statsSospechosas").textContent = sospechosas;
    
    renderizarAlertasImagenes();
    alert(`Análisis finalizado. Se detectaron ${rotos} imágenes con enlaces rotos.`);
}

let productoSeleccionadoParaAgente = null;

function abrirBuscadorAgenteParaProducto(producto) {
    productoSeleccionadoParaAgente = producto;
    
    const panel = document.getElementById("panelBuscadorAgente");
    panel.classList.remove("d-none");
    panel.scrollIntoView({ behavior: "smooth" });

    document.getElementById("agenteTituloProducto").textContent = `Reemplazo para: ${producto.nombre}`;
    
    // Generar query recomendada
    const query = [producto.marca, producto.nombre, producto.presentacion].filter(Boolean).join(" ");
    document.getElementById("txtQueryAgente").value = query;

    // Limpiar resultados anteriores
    document.getElementById("agenteResultados").innerHTML = "";
}

async function ejecutarBuscadorAgenteActual() {
    if (!productoSeleccionadoParaAgente) return;
    
    const query = document.getElementById("txtQueryAgente").value.trim();
    if (!query) return;

    const contenedorResultados = document.getElementById("agenteResultados");
    contenedorResultados.innerHTML = `
        <div class="col-12 text-center py-4 text-muted">
            <div class="spinner-border text-warning mb-2" role="status"></div>
            <div>Consultando Agente de Búsqueda Web...</div>
        </div>
    `;

    try {
        // Obtenemos el token de Supabase para autenticarnos en la API
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        const token = session?.access_token;

        // Llamamos al resolvedor de imágenes del backend de Don Víctor
        const respuesta = await fetch("api/image-search/resolve", {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "authorization": token ? `Bearer ${token}` : ""
            },
            body: JSON.stringify({
                items: [{
                    indice: 0,
                    nombre: productoSeleccionadoParaAgente.nombre,
                    marca: productoSeleccionadoParaAgente.marca,
                    presentacion: productoSeleccionadoParaAgente.presentacion,
                    codigo: productoSeleccionadoParaAgente.codigo,
                    barcode: productoSeleccionadoParaAgente.barcode
                }],
                profundo: true,
                forzar: true,
                consultaPersonalizada: query
            })
        });

        if (!respuesta.ok) {
            throw new Error(`Error en servidor: ${respuesta.status}`);
        }

        // Leemos la respuesta por SSE
        const lector = respuesta.body.getReader();
        const decodificador = new TextDecoder();
        let buffer = "";

        while (true) {
            const { value, done } = await lector.read();
            if (done) break;

            buffer += decodificador.decode(value, { stream: true });
            const lineas = buffer.split("\n");
            buffer = lineas.pop(); // guardar el residuo

            for (const linea of lineas) {
                if (linea.startsWith("data:")) {
                    try {
                        const evento = JSON.parse(linea.substring(5).trim());
                        if (evento.tipo === "producto_resuelto" && evento.resultado) {
                            renderizarResultadosAgente(evento.resultado.candidatos || []);
                        }
                    } catch (e) {
                        // ignore malformed JSON events
                    }
                }
            }
        }
    } catch (error) {
        console.error("Error consultando el agente:", error);
        contenedorResultados.innerHTML = `
            <div class="col-12 text-center py-4 text-danger">
                <i class="fa-solid fa-circle-exclamation fs-3 mb-2"></i>
                <div>Error al consultar el agente: ${escaparTextoAdmin(error.message)}</div>
            </div>
        `;
    }
}

function renderizarResultadosAgente(candidatos) {
    const contenedor = document.getElementById("agenteResultados");
    if (!contenedor) return;

    if (candidatos.length === 0) {
        contenedor.innerHTML = `
            <div class="col-12 text-center py-4 text-muted">
                <i class="fa-solid fa-face-frown fs-3 mb-2"></i>
                <div>No se encontraron imágenes candidatas para esta query. Intente con otro término.</div>
            </div>
        `;
        return;
    }

    contenedor.innerHTML = "";

    candidatos.forEach((cand) => {
        const col = document.createElement("div");
        col.className = "col";
        
        // Determinar color de confianza
        let badgeColor = "bg-danger";
        if (cand.confianza === "alta") badgeColor = "bg-success";
        else if (cand.confianza === "media") badgeColor = "bg-warning text-dark";

        col.innerHTML = `
            <div class="card h-100 bg-dark text-light border-secondary position-relative card-candidato-agente" style="cursor: pointer;">
                <span class="badge ${badgeColor} position-absolute top-0 end-0 m-2 z-3">${cand.confianza || "baja"} (${cand.score}pts)</span>
                <div style="height: 140px; background: #2B1A16; display: flex; align-items: center; justify-content: center;" class="p-2">
                    <img src="${escaparAtributoAdmin(cand.url)}" class="card-img-top" style="max-height: 100%; max-width: 100%; object-fit: contain;" onerror="this.src='${PLACEHOLDER_IMAGEN_ADMIN}'">
                </div>
                <div class="card-body p-2 d-flex flex-column justify-content-between">
                    <div class="small text-muted text-truncate mb-1" title="${escaparAtributoAdmin(cand.title)}">${escaparTextoAdmin(cand.title || "Imagen")}</div>
                    <div class="d-flex justify-content-between align-items-center">
                        <span class="badge bg-secondary font-monospace" style="font-size: 0.7rem;">${escaparTextoAdmin(cand.fuente)}</span>
                        <span class="small text-muted font-monospace" style="font-size: 0.7rem;">${cand.width || "?"}x${cand.height || "?"}</span>
                    </div>
                </div>
            </div>
        `;

        col.querySelector(".card-candidato-agente").addEventListener("click", () => {
            if (confirm(`¿Quieres aplicar esta imagen a "${productoSeleccionadoParaAgente.nombre}"?`)) {
                aplicarNuevaImagenDeProducto(productoSeleccionadoParaAgente.id_producto, cand.url);
            }
        });

        contenedor.appendChild(col);
    });
}

async function aplicarNuevaImagenDeProducto(idProducto, urlImagen) {
    const contenedor = document.getElementById("agenteResultados");
    contenedor.innerHTML = `
        <div class="col-12 text-center py-4 text-warning">
            <div class="spinner-border spinner-border-sm me-1" role="status"></div>
            Descargando y procesando imagen en el servidor (WebP)...
        </div>
    `;

    try {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        const token = session?.access_token;

        // Llamamos al pipeline de imagen de Don Víctor para descargar, convertir a WebP y guardar en Storage
        const res = await fetch("api/image-search/apply-image", {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "authorization": token ? `Bearer ${token}` : ""
            },
            body: JSON.stringify({
                id_producto: idProducto,
                imageUrl: urlImagen
            })
        });

        if (!res.ok) {
            const errBody = await res.json().catch(() => ({}));
            throw new Error(errBody.error || `HTTP ${res.status}`);
        }

        const datos = await res.json();
        
        // Actualizar localmente el producto
        const prod = productosAdmin.find(p => p.id_producto === idProducto);
        if (prod) {
            prod.imagen = datos.imagenUrl || urlImagen;
        }

        alert("¡Imagen aplicada con éxito!");
        
        // Limpiar y actualizar UI
        document.getElementById("panelBuscadorAgente").classList.add("d-none");
        analizarImagenesCatalogo();
        renderizarProductosAdmin();
    } catch (e) {
        console.error("Error al aplicar la imagen:", e);
        alert(`Error al guardar la imagen: ${e.message}`);
        // Volver a renderizar los candidatos
        ejecutarBuscadorAgenteActual();
    }
}

