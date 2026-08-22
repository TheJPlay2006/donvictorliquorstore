// Importación masiva de productos (CSV/XLSX + ZIP de imágenes) para el panel
// admin. Reutiliza el mismo cliente de Supabase, el mismo pipeline de
// imágenes (window.subirImagenAdmin, de storage.js) y las mismas políticas
// RLS que el alta individual (producto-form.js) — no hay backend propio en
// este proyecto: todo el "servidor" es Postgres/Storage vía supabase-js, así
// que la importación corre en el navegador del admin autenticado, igual que
// el resto del panel.
//
// Para no hacer una petición por producto, los inserts/updates a la base se
// agrupan en lotes (bulk insert / bulk upsert) de CHUNK_TAMANIO filas; las
// imágenes sí requieren una llamada de Storage por archivo, pero se suben con
// concurrencia limitada.

(function () {
    "use strict";

    var CHUNK_TAMANIO = 25;
    var CONCURRENCIA_IMAGENES = 4;
    var MAX_FILAS = 2000;
    var MAX_TAMANIO_CSV_XLSX = 10 * 1024 * 1024;
    var MAX_TAMANIO_ZIP = 60 * 1024 * 1024;
    var MAX_ARCHIVOS_ZIP = 1000;
    var MAX_TAMANIO_IMAGEN = 8 * 1024 * 1024; // igual que storage.js
    var MAX_DESCOMPRIMIDO_ZIP = 400 * 1024 * 1024;
    var EXTENSIONES_IMAGEN = ["jpg", "jpeg", "png", "webp"];
    var MIME_POR_EXTENSION = {
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        webp: "image/webp"
    };

    var CAMPOS_ESPERADOS = [
        "nombre", "marca", "presentacion", "codigo", "barcode", "descripcion", "categoria",
        "precio", "stock", "disponibilidad", "destacado", "promocion", "activo", "imagen"
    ];

    var PALABRAS_VERDADERO = ["true", "1", "si", "sí", "yes", "x", "activo", "disponible"];
    var PALABRAS_FALSO = ["false", "0", "no", "agotado", "inactivo"];

    var categoriasDisponibles = [];
    var mapaCategoriasNormalizadas = new Map();

    var archivoProductosSeleccionado = null;
    var mapaImagenesZip = null; // Map<nombreBaseMinuscula, {entry, ext, mime}>
    var cantidadImagenesZip = 0;

    var filasValidadas = [];
    var importando = false;
    var ultimoReporteErrores = [];
    var ultimoNombreArchivo = "";

    // Búsqueda automática de imágenes (backend, ver api/image-search/*.js).
    var ITEMS_POR_LLAMADA_BUSQUEDA = 40;
    var configuracionBusqueda = { enabled: false, providers: [], paidProviderActive: false, maxPerImport: 300, concurrency: 3 };
    var NOMBRE_LEGIBLE_FUENTE = {
        openfoodfacts: "Open Food Facts", wikimedia: "Wikimedia Commons",
        openverse: "Openverse", exa: "Exa", zip: "ZIP", url: "URL"
    };
    var buscandoImagenes = false;
    var indiceDialogoActual = null;

    document.addEventListener("admin-listo", inicializar);

    async function inicializar() {
        await cargarCategorias();
        await cargarConfiguracionBusqueda();
        configurarDropzones();
        configurarPlantillas();
        configurarBotones();
        configurarDialogoCandidatos();
    }

    async function obtenerAccessToken() {
        var sesion = await window.supabaseClient.auth.getSession();
        return sesion && sesion.data && sesion.data.session ? sesion.data.session.access_token : null;
    }

    async function cargarConfiguracionBusqueda() {
        var checkbox = document.getElementById("checkBusquedaAutomatica");
        var estado = document.getElementById("estadoBusquedaAutomatica");

        try {
            var respuesta = await fetch("api/image-search/status");
            if (respuesta.ok) {
                configuracionBusqueda = await respuesta.json();
            }
        } catch (error) {
            console.error("[PRODUCT_IMPORT] no se pudo consultar el estado de búsqueda de imágenes", error);
        }

        if (configuracionBusqueda.enabled) {
            checkbox.checked = true;
            checkbox.disabled = false;
            var nombresFuentes = (configuracionBusqueda.providers || []).map(function (p) {
                return NOMBRE_LEGIBLE_FUENTE[p] || p;
            });
            if (configuracionBusqueda.paidProviderActive) { nombresFuentes.push("Exa"); }
            estado.textContent = "✓ Búsqueda automática disponible (fuentes gratuitas: " +
                (nombresFuentes.length ? nombresFuentes.join(", ") : "ninguna") + ") · hasta " +
                configuracionBusqueda.maxPerImport + " búsquedas por importación.";
        } else {
            checkbox.checked = false;
            checkbox.disabled = true;
            estado.textContent = "La búsqueda automática está apagada (IMAGE_SEARCH_ENABLED=false). Podés seguir usando el ZIP.";
        }
    }

    async function cargarCategorias() {
        var respuesta = await window.supabaseClient
            .from("categorias")
            .select("id_categoria, nombre")
            .order("nombre", { ascending: true });

        if (respuesta.error) {
            console.error("[PRODUCT_IMPORT] error al cargar categorías", respuesta.error);
            categoriasDisponibles = [];
            return;
        }

        categoriasDisponibles = respuesta.data || [];
        mapaCategoriasNormalizadas = new Map();
        categoriasDisponibles.forEach(function (categoria) {
            mapaCategoriasNormalizadas.set(normalizarTexto(categoria.nombre), categoria);
        });
    }

    // ---------------------------------------------------------------------
    // Plantillas descargables
    // ---------------------------------------------------------------------

    function filasEjemplo() {
        return [
            {
                nombre: "Johnnie Walker Black Label", marca: "Johnnie Walker", presentacion: "750 ml",
                codigo: "JW-BLACK-750", descripcion: "Whisky escocés 12 años", categoria: "Whisky y bourbon",
                precio: 18500, stock: 12, disponibilidad: "disponible", destacado: "true", promocion: "false",
                activo: "true", imagen: "JW-BLACK-750.jpg"
            },
            {
                nombre: "Absolut Vodka", marca: "Absolut", presentacion: "750 ml",
                codigo: "ABS-750", descripcion: "Vodka sueco", categoria: "Vodka",
                precio: 9200, stock: 20, disponibilidad: "disponible", destacado: "false", promocion: "false",
                activo: "true", imagen: "ABS-750.png"
            },
            {
                nombre: "Baileys Original", marca: "Baileys", presentacion: "750 ml",
                codigo: "BAI-750", descripcion: "Crema irlandesa", categoria: "Licores, cremas y aperitivos",
                precio: 12500, stock: 8, disponibilidad: "disponible", destacado: "true", promocion: "true",
                activo: "true", imagen: "https://example.com/images/baileys.jpg"
            }
        ];
    }

    function configurarPlantillas() {
        document.getElementById("btnDescargarPlantillaCsv").addEventListener("click", function () {
            var csv = Papa.unparse({ fields: CAMPOS_ESPERADOS, data: filasEjemplo() });
            descargarBlob(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }), "plantilla-productos-donvictor.csv");
        });

        document.getElementById("btnDescargarPlantillaXlsx").addEventListener("click", function () {
            var datos = filasEjemplo().map(function (fila) {
                var ordenada = {};
                CAMPOS_ESPERADOS.forEach(function (campo) { ordenada[campo] = fila[campo]; });
                return ordenada;
            });
            var hoja = XLSX.utils.json_to_sheet(datos, { header: CAMPOS_ESPERADOS });
            var libro = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(libro, hoja, "Productos");
            var arrayBuffer = XLSX.write(libro, { bookType: "xlsx", type: "array" });
            descargarBlob(new Blob([arrayBuffer], { type: "application/octet-stream" }), "plantilla-productos-donvictor.xlsx");
        });
    }

    function descargarBlob(blob, nombreArchivo) {
        var url = URL.createObjectURL(blob);
        var enlace = document.createElement("a");
        enlace.href = url;
        enlace.download = nombreArchivo;
        document.body.appendChild(enlace);
        enlace.click();
        enlace.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    }

    // ---------------------------------------------------------------------
    // Dropzones / selección de archivos
    // ---------------------------------------------------------------------

    function configurarDropzones() {
        configurarUnaDropzone(
            document.getElementById("dzProductos"),
            document.getElementById("inputProductos"),
            function (archivo) { seleccionarArchivoProductos(archivo); }
        );

        configurarUnaDropzone(
            document.getElementById("dzImagenes"),
            document.getElementById("inputImagenes"),
            function (archivo) { seleccionarArchivoImagenes(archivo); }
        );
    }

    function configurarUnaDropzone(zona, input, alSeleccionar) {
        zona.addEventListener("click", function () { input.click(); });
        zona.addEventListener("keydown", function (evento) {
            if (evento.key === "Enter" || evento.key === " ") {
                evento.preventDefault();
                input.click();
            }
        });

        ["dragenter", "dragover"].forEach(function (tipo) {
            zona.addEventListener(tipo, function (evento) {
                evento.preventDefault();
                zona.classList.add("admin-dropzone-activa");
            });
        });

        ["dragleave", "drop"].forEach(function (tipo) {
            zona.addEventListener(tipo, function (evento) {
                evento.preventDefault();
                zona.classList.remove("admin-dropzone-activa");
            });
        });

        zona.addEventListener("drop", function (evento) {
            var archivo = evento.dataTransfer.files && evento.dataTransfer.files[0];
            if (archivo) { alSeleccionar(archivo); }
        });

        input.addEventListener("change", function (evento) {
            var archivo = evento.target.files && evento.target.files[0];
            if (archivo) { alSeleccionar(archivo); }
        });
    }

    function seleccionarArchivoProductos(archivo) {
        var estado = document.getElementById("estadoArchivoProductos");
        var extension = (archivo.name.split(".").pop() || "").toLowerCase();

        if (extension !== "csv" && extension !== "xlsx") {
            estado.textContent = "Formato no soportado. Usá .csv o .xlsx.";
            archivoProductosSeleccionado = null;
            actualizarDisponibilidadValidar();
            return;
        }

        if (archivo.size > MAX_TAMANIO_CSV_XLSX) {
            estado.textContent = "El archivo supera el máximo permitido (10 MB).";
            archivoProductosSeleccionado = null;
            actualizarDisponibilidadValidar();
            return;
        }

        archivoProductosSeleccionado = archivo;
        estado.textContent = archivo.name + " (" + formatearTamanio(archivo.size) + ")";
        ocultarSeccionesResultado();
        actualizarDisponibilidadValidar();
    }

    async function seleccionarArchivoImagenes(archivo) {
        var estado = document.getElementById("estadoArchivoImagenes");

        if (!/\.zip$/i.test(archivo.name)) {
            estado.textContent = "Formato no soportado. Usá un archivo .zip.";
            mapaImagenesZip = null;
            return;
        }

        if (archivo.size > MAX_TAMANIO_ZIP) {
            estado.textContent = "El ZIP supera el máximo permitido (60 MB).";
            mapaImagenesZip = null;
            return;
        }

        estado.textContent = "Leyendo ZIP…";

        try {
            var resultado = await procesarZip(archivo);
            mapaImagenesZip = resultado.mapa;
            cantidadImagenesZip = resultado.mapa.size;
            estado.textContent = cantidadImagenesZip + (cantidadImagenesZip === 1 ? " imagen encontrada" : " imágenes encontradas") +
                (resultado.ignorados > 0 ? " (" + resultado.ignorados + " archivos ignorados: no son imágenes JPEG/PNG/WebP o superan 8 MB)" : "");
        } catch (error) {
            console.error("[PRODUCT_IMPORT] error al leer ZIP", error);
            estado.textContent = error.message || "No se pudo leer el ZIP.";
            mapaImagenesZip = null;
        }

        ocultarSeccionesResultado();
    }

    async function procesarZip(archivo) {
        var zip = await JSZip.loadAsync(archivo);
        var nombres = Object.keys(zip.files);
        var entradasArchivo = [];

        nombres.forEach(function (nombre) {
            var entrada = zip.files[nombre];
            if (entrada.dir) { return; }
            entradasArchivo.push(entrada);
        });

        if (entradasArchivo.length > MAX_ARCHIVOS_ZIP) {
            throw new Error("El ZIP contiene demasiados archivos (máximo " + MAX_ARCHIVOS_ZIP + ").");
        }

        var mapa = new Map();
        var ignorados = 0;
        var totalDescomprimidoAprox = 0;

        for (var i = 0; i < entradasArchivo.length; i++) {
            var entrada = entradasArchivo[i];
            var rutaNormalizada = String(entrada.name).replace(/\\/g, "/");

            // Nunca construimos rutas de filesystem a partir de esto (JSZip
            // vive en memoria, y además JSZip ya neutraliza "../" al leer el
            // ZIP), pero igual rechazamos cualquier segmento ".." como
            // higiene defensiva explícita (por si acaso, y para dejar la
            // intención clara en el código).
            if (contienePathTraversal(rutaNormalizada)) {
                ignorados++;
                continue;
            }

            var base = obtenerNombreBase(rutaNormalizada);
            var ext = (base.split(".").pop() || "").toLowerCase();

            if (EXTENSIONES_IMAGEN.indexOf(ext) === -1) {
                ignorados++;
                continue;
            }

            var tamanioAprox = entrada._data && typeof entrada._data.uncompressedSize === "number"
                ? entrada._data.uncompressedSize
                : null;

            if (tamanioAprox !== null) {
                totalDescomprimidoAprox += tamanioAprox;
                if (totalDescomprimidoAprox > MAX_DESCOMPRIMIDO_ZIP) {
                    throw new Error("El contenido descomprimido del ZIP es demasiado grande.");
                }
                if (tamanioAprox > MAX_TAMANIO_IMAGEN) {
                    ignorados++;
                    continue;
                }
            }

            mapa.set(base.toLowerCase(), { entry: entrada, ext: ext, mime: MIME_POR_EXTENSION[ext] });
        }

        return { mapa: mapa, ignorados: ignorados };
    }

    function contienePathTraversal(rutaNormalizada) {
        return rutaNormalizada.split("/").indexOf("..") !== -1;
    }

    function obtenerNombreBase(ruta) {
        var partes = String(ruta).split("/").filter(function (parte) {
            return parte !== "" && parte !== "." && parte !== "..";
        });
        return partes.length ? partes[partes.length - 1] : String(ruta);
    }

    function actualizarDisponibilidadValidar() {
        document.getElementById("btnValidarArchivo").disabled = !archivoProductosSeleccionado || importando;
    }

    function ocultarSeccionesResultado() {
        document.getElementById("seccionResumen").hidden = true;
        document.getElementById("seccionResultado").hidden = true;
    }

    // ---------------------------------------------------------------------
    // Parseo de CSV / XLSX
    // ---------------------------------------------------------------------

    function leerFilasDeArchivo(archivo) {
        var extension = (archivo.name.split(".").pop() || "").toLowerCase();

        if (extension === "csv") {
            return leerCsv(archivo);
        }
        return leerXlsx(archivo);
    }

    function leerCsv(archivo) {
        return new Promise(function (resolve, reject) {
            Papa.parse(archivo, {
                header: true,
                skipEmptyLines: "greedy",
                encoding: "UTF-8",
                transformHeader: function (encabezado) {
                    return String(encabezado || "").trim().toLowerCase();
                },
                complete: function (resultado) {
                    if (resultado.errors && resultado.errors.length) {
                        var errorFatal = resultado.errors.find(function (e) { return e.code !== "TooFewFields" && e.code !== "TooManyFields"; });
                        if (errorFatal) {
                            reject(new Error("No se pudo leer el CSV: " + errorFatal.message));
                            return;
                        }
                    }
                    resolve(resultado.data);
                },
                error: function (error) {
                    reject(new Error("No se pudo leer el CSV: " + error.message));
                }
            });
        });
    }

    async function leerXlsx(archivo) {
        var arrayBuffer = await archivo.arrayBuffer();
        var libro = XLSX.read(arrayBuffer, { type: "array" });
        var primeraHoja = libro.SheetNames[0];

        if (!primeraHoja) {
            throw new Error("El archivo Excel no tiene hojas.");
        }

        var filas = XLSX.utils.sheet_to_json(libro.Sheets[primeraHoja], { defval: "", raw: true });

        return filas.map(function (fila) {
            var normalizada = {};
            Object.keys(fila).forEach(function (clave) {
                normalizada[String(clave).trim().toLowerCase()] = fila[clave];
            });
            return normalizada;
        });
    }

    // ---------------------------------------------------------------------
    // Utilidades de parseo/normalización de campos
    // ---------------------------------------------------------------------

    function normalizarTexto(texto) {
        return String(texto == null ? "" : texto)
            .normalize("NFD")
            .replace(/[̀-ͯ]/g, "")
            .toLowerCase()
            .trim()
            .replace(/\s+/g, " ");
    }

    function limpiarNumeroTexto(valor) {
        return String(valor == null ? "" : valor).replace(/[^\d.,-]/g, "").trim();
    }

    // Acepta "18500", "18.500", "18,500", "18.500,50", "18500.50", etc. — de
    // uso frecuente al exportar desde Excel/LibreOffice en configuraciones
    // regionales latinoamericanas (coma o punto como separador decimal).
    function parseNumeroLatino(valorOriginal) {
        if (typeof valorOriginal === "number") { return valorOriginal; }

        var texto = limpiarNumeroTexto(valorOriginal);
        if (texto === "" || texto === "-") { return NaN; }

        var ultimaComa = texto.lastIndexOf(",");
        var ultimoPunto = texto.lastIndexOf(".");

        if (ultimaComa !== -1 && ultimoPunto !== -1) {
            if (ultimaComa > ultimoPunto) {
                texto = texto.replace(/\./g, "").replace(",", ".");
            } else {
                texto = texto.replace(/,/g, "");
            }
        } else if (ultimaComa !== -1) {
            var partesComa = texto.split(",");
            if (partesComa.length === 2 && partesComa[1].length <= 2) {
                texto = partesComa[0] + "." + partesComa[1];
            } else {
                texto = texto.replace(/,/g, "");
            }
        } else if (ultimoPunto !== -1) {
            var partesPunto = texto.split(".");
            if (partesPunto.length > 2 || (partesPunto.length === 2 && partesPunto[1].length === 3)) {
                texto = texto.replace(/\./g, "");
            }
        }

        return parseFloat(texto);
    }

    function parseBooleano(valorOriginal, porDefecto) {
        if (typeof valorOriginal === "boolean") { return { valor: valorOriginal, reconocido: true }; }
        if (valorOriginal === null || valorOriginal === undefined) { return { valor: porDefecto, reconocido: true }; }

        var texto = normalizarTexto(valorOriginal);
        if (texto === "") { return { valor: porDefecto, reconocido: true }; }
        if (PALABRAS_VERDADERO.indexOf(texto) !== -1) { return { valor: true, reconocido: true }; }
        if (PALABRAS_FALSO.indexOf(texto) !== -1) { return { valor: false, reconocido: true }; }

        return { valor: porDefecto, reconocido: false };
    }

    function esUrlHttp(texto) {
        return /^https?:\/\//i.test(String(texto || "").trim());
    }

    function validarUrlImagenPermitida(textoUrl) {
        var url;
        try {
            url = new URL(textoUrl);
        } catch (error) {
            return false;
        }

        if (url.protocol !== "http:" && url.protocol !== "https:") { return false; }

        var host = url.hostname.toLowerCase();
        if (host === "localhost" || host === "0.0.0.0" || host === "::1") { return false; }
        if (/^127\./.test(host)) { return false; }
        if (/^10\./.test(host)) { return false; }
        if (/^192\.168\./.test(host)) { return false; }
        if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) { return false; }
        if (/^169\.254\./.test(host)) { return false; }
        if (host.indexOf("fe80:") === 0 || host.indexOf("fc") === 0 || host.indexOf("fd") === 0) { return false; }

        return true;
    }

    // ---------------------------------------------------------------------
    // Validación de filas
    // ---------------------------------------------------------------------

    async function validarArchivos() {
        var boton = document.getElementById("btnValidarArchivo");
        var estado = document.getElementById("estadoValidando");

        boton.disabled = true;
        estado.hidden = false;
        ocultarSeccionesResultado();

        try {
            ultimoNombreArchivo = archivoProductosSeleccionado.name;
            var filasCrudas = await leerFilasDeArchivo(archivoProductosSeleccionado);

            filasCrudas = filasCrudas.filter(function (fila) {
                return Object.keys(fila).some(function (clave) {
                    return String(fila[clave]).trim() !== "";
                });
            });

            if (filasCrudas.length === 0) {
                alert("El archivo no tiene filas con datos.");
                return;
            }

            if (filasCrudas.length > MAX_FILAS) {
                alert("El archivo tiene " + filasCrudas.length + " filas. El máximo soportado por importación es " + MAX_FILAS + ".");
                return;
            }

            var filas = filasCrudas.map(function (fila, indice) {
                return validarFila(fila, indice);
            });

            await resolverDuplicadosPorCodigo(filas);

            filasValidadas = filas;
            renderizarResumenYPreview();

            // §13/§24: si la búsqueda automática está activada, el flujo
            // completo es leer → validar → detectar imágenes disponibles →
            // buscar las que faltan → mostrar preview con fotos, sin un
            // segundo clic. El botón manual "Buscar N imágenes
            // automáticamente" sigue disponible para volver a intentarlo.
            if (document.getElementById("checkBusquedaAutomatica").checked && configuracionBusqueda.enabled) {
                var hayFaltantes = filasValidadas.some(filaElegibleParaBusqueda);
                if (hayFaltantes) {
                    await buscarImagenesFaltantes();
                }
            }
        } catch (error) {
            console.error("[PRODUCT_IMPORT] error al validar", error);
            alert(error.message || "No se pudo procesar el archivo.");
        } finally {
            estado.hidden = true;
            boton.disabled = false;
        }
    }

    // ---------------------------------------------------------------------
    // Búsqueda automática de imágenes (backend)
    // ---------------------------------------------------------------------

    async function buscarImagenesFaltantes() {
        if (buscandoImagenes) { return; }

        var faltantes = filasValidadas
            .map(function (fila, indice) { return { fila: fila, indice: indice }; })
            .filter(function (par) { return filaElegibleParaBusqueda(par.fila); });

        if (faltantes.length === 0) { return; }

        buscandoImagenes = true;
        var botonGlobal = document.getElementById("btnBuscarFaltantes");
        var estadoTexto = document.getElementById("estadoBuscandoImagenes");
        botonGlobal.disabled = true;
        estadoTexto.hidden = false;
        estadoTexto.textContent = "Buscando imágenes… 0 / " + faltantes.length;

        var procesadosTotal = 0;
        var token = await obtenerAccessToken();

        if (!token) {
            estadoTexto.textContent = "Sesión inválida: no se pudo buscar imágenes.";
            buscandoImagenes = false;
            botonGlobal.disabled = false;
            return;
        }

        for (var i = 0; i < faltantes.length; i += ITEMS_POR_LLAMADA_BUSQUEDA) {
            var lote = faltantes.slice(i, i + ITEMS_POR_LLAMADA_BUSQUEDA);
            var items = lote.map(function (par) {
                return {
                    indice: par.indice,
                    nombre: par.fila.nombre,
                    marca: par.fila.marca,
                    presentacion: par.fila.presentacion,
                    codigo: par.fila.codigo,
                    barcode: par.fila.barcode
                };
            });

            try {
                await llamarResolveSSE(token, { items: items }, function (evento) {
                    if (evento.tipo === "item") {
                        aplicarResultadoBusqueda(evento.datos);
                    } else if (evento.tipo === "progreso") {
                        procesadosTotal = i + evento.datos.procesados;
                        estadoTexto.textContent = "Buscando imágenes… " + procesadosTotal + " / " + faltantes.length;
                    }
                });
            } catch (error) {
                console.error("[PRODUCT_IMPORT] error en búsqueda automática de imágenes", error);
                estadoTexto.textContent = "La búsqueda automática se interrumpió: " + (error.message || "error desconocido") + ".";
                break;
            }
        }

        buscandoImagenes = false;
        botonGlobal.disabled = false;
        estadoTexto.hidden = false;
        renderizarResumenYPreview();
    }

    function aplicarResultadoBusqueda(datos) {
        var fila = filasValidadas[datos.indice];
        if (!fila) { return; }

        if (datos.estado === "encontrada" || datos.estado === "revisar") {
            fila.resolucionImagen = {
                tipo: "busqueda",
                valor: datos.ganador.url,
                candidatos: datos.candidatos || [],
                confianza: datos.confianza,
                searchQuery: datos.searchQuery,
                fuente: datos.ganador.fuente || null,
                licencia: datos.ganador.license || null,
                licenciaUrl: datos.ganador.licenseUrl || null,
                autor: datos.ganador.author || null,
                sourceUrlGanador: datos.ganador.sourceUrl || null,
                autoSeleccionado: true
            };
            if (datos.estado === "revisar") {
                fila.advertencias.push("Imagen encontrada automáticamente con confianza media — revisar antes de importar.");
            }
        } else {
            // sin_resultado / error_temporal / error_proveedor / omitido_limite:
            // no se asigna ninguna imagen a ciegas (§8/§23).
            fila.resolucionImagen = { tipo: "ninguna", candidatosPrevios: datos.candidatos || [], searchQuery: datos.searchQuery };
            if (datos.estado === "sin_resultado") {
                fila.advertencias.push("No se encontró una imagen confiable automáticamente.");
            } else if (datos.mensaje) {
                fila.advertencias.push("Búsqueda de imagen: " + datos.mensaje);
            }
        }
    }

    // Lee la respuesta Server-Sent-Events de /api/image-search/resolve línea
    // por línea, invocando `alEvento({tipo, datos})` apenas llega cada evento
    // completo (progreso real, ver §13 — nunca se simula).
    async function llamarResolveSSE(token, cuerpo, alEvento) {
        var respuesta = await fetch("api/image-search/resolve", {
            method: "POST",
            headers: { "content-type": "application/json", authorization: "Bearer " + token },
            body: JSON.stringify(cuerpo)
        });

        if (!respuesta.ok) {
            var detalle = await respuesta.json().catch(function () { return {}; });
            throw new Error(detalle.error || ("HTTP " + respuesta.status));
        }

        var lector = respuesta.body.getReader();
        var decodificador = new TextDecoder("utf-8");
        var bufferTexto = "";

        for (;;) {
            var resultado = await lector.read();
            if (resultado.done) { break; }

            bufferTexto += decodificador.decode(resultado.value, { stream: true });
            var bloques = bufferTexto.split("\n\n");
            bufferTexto = bloques.pop();

            bloques.forEach(function (bloque) {
                var tipo = "message";
                var datosCrudos = "";
                bloque.split("\n").forEach(function (linea) {
                    if (linea.indexOf("event:") === 0) { tipo = linea.slice(6).trim(); }
                    else if (linea.indexOf("data:") === 0) { datosCrudos = linea.slice(5).trim(); }
                });
                if (datosCrudos) {
                    try {
                        alEvento({ tipo: tipo, datos: JSON.parse(datosCrudos) });
                    } catch (error) {
                        console.error("[PRODUCT_IMPORT] evento SSE inválido", error);
                    }
                }
            });
        }
    }

    function validarFila(filaCruda, indice) {
        var numeroFila = indice + 2; // +1 por encabezado, +1 por índice base 1
        var errores = [];
        var advertencias = [];

        var nombre = String(filaCruda.nombre == null ? "" : filaCruda.nombre).trim();
        if (!nombre) { errores.push("El nombre es obligatorio."); }
        if (nombre.length > 150) { errores.push("El nombre supera los 150 caracteres."); }

        var marca = String(filaCruda.marca == null ? "" : filaCruda.marca).trim();
        if (marca.length > 100) { errores.push("La marca supera los 100 caracteres."); }

        var presentacion = String(filaCruda.presentacion == null ? "" : filaCruda.presentacion).trim();
        if (presentacion.length > 100) { errores.push("La presentación supera los 100 caracteres."); }

        var codigo = String(filaCruda.codigo == null ? "" : filaCruda.codigo).trim();
        if (codigo.length > 50) { errores.push("El código supera los 50 caracteres."); }

        // Columna opcional, solo para mejorar la consulta de búsqueda
        // automática de imagen (§6/§22): un EAN/UPC/GTIN identifica el
        // producto exacto mejor que el texto. NO se guarda en la base de
        // datos ni se confunde con `codigo` (código interno de la tienda).
        var barcode = String(filaCruda.barcode == null ? (filaCruda.gtin == null ? "" : filaCruda.gtin) : filaCruda.barcode).trim();

        var descripcion = String(filaCruda.descripcion == null ? "" : filaCruda.descripcion).trim();

        var nombreCategoriaOriginal = String(filaCruda.categoria == null ? "" : filaCruda.categoria).trim();
        var categoriaEncontrada = null;
        if (!nombreCategoriaOriginal) {
            errores.push("La categoría es obligatoria.");
        } else {
            categoriaEncontrada = mapaCategoriasNormalizadas.get(normalizarTexto(nombreCategoriaOriginal)) || null;
            if (!categoriaEncontrada) {
                errores.push('La categoría "' + nombreCategoriaOriginal + '" no existe.');
            }
        }

        var precio = parseNumeroLatino(filaCruda.precio);
        if (!isFinite(precio) || isNaN(precio) || precio < 0) {
            errores.push("El precio no es válido.");
            precio = null;
        } else {
            precio = Math.round(precio * 100) / 100;
        }

        var stock = parseNumeroLatino(filaCruda.stock);
        if (!isFinite(stock) || isNaN(stock) || stock < 0 || Math.round(stock) !== stock) {
            errores.push("El stock debe ser un número entero mayor o igual a 0.");
            stock = null;
        } else {
            stock = Math.round(stock);
        }

        var disponibleParseado = parseBooleano(filaCruda.disponibilidad, true);
        if (!disponibleParseado.reconocido) { advertencias.push('Valor de "disponibilidad" no reconocido, se usó "disponible".'); }

        var destacadoParseado = parseBooleano(filaCruda.destacado, false);
        if (!destacadoParseado.reconocido) { advertencias.push('Valor de "destacado" no reconocido, se usó "false".'); }

        var promocionParseado = parseBooleano(filaCruda.promocion, false);
        if (!promocionParseado.reconocido) { advertencias.push('Valor de "promocion" no reconocido, se usó "false".'); }

        var activoParseado = parseBooleano(filaCruda.activo, true);
        if (!activoParseado.reconocido) { advertencias.push('Valor de "activo" no reconocido, se usó "true".'); }

        var resolucionImagen = resolverImagenFila(filaCruda, codigo);
        if (resolucionImagen.tipo === "faltante") {
            advertencias.push(resolucionImagen.advertencia);
        }

        return {
            numeroFila: numeroFila,
            nombre: nombre,
            marca: marca || null,
            presentacion: presentacion || null,
            codigo: codigo || null,
            barcode: barcode || null,
            descripcion: descripcion || null,
            categoriaNombre: categoriaEncontrada ? categoriaEncontrada.nombre : nombreCategoriaOriginal,
            idCategoria: categoriaEncontrada ? categoriaEncontrada.id_categoria : null,
            precio: precio,
            stock: stock,
            disponible: disponibleParseado.valor,
            destacado: destacadoParseado.valor,
            promocion: promocionParseado.valor,
            estado: activoParseado.valor,
            resolucionImagen: resolucionImagen,
            errores: errores,
            advertencias: advertencias,
            estadoDuplicado: "nuevo", // 'nuevo' | 'actualizar' | 'existente'
            idProductoExistente: null,
            imagenExistente: null
        };
    }

    function resolverImagenFila(filaCruda, codigo) {
        var valorImagen = String(filaCruda.imagen == null ? "" : filaCruda.imagen).trim();

        if (valorImagen) {
            if (esUrlHttp(valorImagen)) {
                return { tipo: "url", valor: valorImagen };
            }

            var base = obtenerNombreBase(valorImagen).toLowerCase();

            if (!mapaImagenesZip) {
                return { tipo: "faltante", advertencia: 'Imagen "' + valorImagen + '" indicada pero no se cargó ningún ZIP.' };
            }

            var entrada = mapaImagenesZip.get(base);
            if (!entrada) {
                return { tipo: "faltante", advertencia: 'Imagen "' + valorImagen + '" no encontrada en el ZIP.' };
            }

            return { tipo: "zip", entrada: entrada, nombreArchivo: base };
        }

        if (codigo && mapaImagenesZip) {
            for (var i = 0; i < EXTENSIONES_IMAGEN.length; i++) {
                var candidato = (codigo + "." + EXTENSIONES_IMAGEN[i]).toLowerCase();
                var entradaPorCodigo = mapaImagenesZip.get(candidato);
                if (entradaPorCodigo) {
                    return { tipo: "zip", entrada: entradaPorCodigo, nombreArchivo: candidato, porCodigo: true };
                }
            }
        }

        return { tipo: "ninguna" };
    }

    async function resolverDuplicadosPorCodigo(filas) {
        var codigosVistos = new Map(); // codigo -> primera fila que lo usa
        filas.forEach(function (fila) {
            if (!fila.codigo) { return; }
            if (codigosVistos.has(fila.codigo)) {
                fila.errores.push("Código duplicado en el archivo (ya aparece en la fila " + codigosVistos.get(fila.codigo) + ").");
            } else {
                codigosVistos.set(fila.codigo, fila.numeroFila);
            }
        });

        var codigosAConsultar = Array.from(codigosVistos.keys());
        var mapaExistentes = new Map();

        for (var i = 0; i < codigosAConsultar.length; i += 200) {
            var lote = codigosAConsultar.slice(i, i + 200);
            var respuesta = await window.supabaseClient
                .from("productos")
                .select("id_producto, codigo, imagen")
                .in("codigo", lote);

            if (respuesta.error) {
                throw new Error("No se pudo verificar productos existentes: " + respuesta.error.message);
            }

            (respuesta.data || []).forEach(function (producto) {
                mapaExistentes.set(producto.codigo, producto);
            });
        }

        var modoDuplicados = document.querySelector('input[name="modoDuplicados"]:checked').value;

        filas.forEach(function (fila) {
            if (!fila.codigo) { return; }
            var existente = mapaExistentes.get(fila.codigo);
            if (!existente) { return; }

            if (modoDuplicados === "crear") {
                fila.estadoDuplicado = "existente";
            } else {
                fila.estadoDuplicado = "actualizar";
                fila.idProductoExistente = existente.id_producto;
                fila.imagenExistente = existente.imagen;
            }
        });
    }

    function estadoFinalDeFila(fila) {
        if (fila.errores.length > 0) { return "error"; }
        if (fila.estadoDuplicado === "existente") { return "existente"; }
        if (fila.advertencias.length > 0) { return "advertencia"; }
        return "valido";
    }

    // Una fila es candidata a búsqueda automática si va a importarse, todavía
    // no tiene ninguna imagen resuelta (ni URL, ni ZIP), y — si es una
    // actualización — no tiene ya una imagen que estemos protegiendo (§17:
    // no reemplazar imágenes existentes salvo que el admin lo pida).
    function filaElegibleParaBusqueda(fila) {
        var estado = estadoFinalDeFila(fila);
        if (estado === "error" || estado === "existente") { return false; }
        if (fila.resolucionImagen.tipo !== "ninguna") { return false; }

        var permitirReemplazo = document.getElementById("checkReemplazarImagenes").checked;
        if (fila.estadoDuplicado === "actualizar" && fila.imagenExistente && !permitirReemplazo) {
            return false;
        }
        return true;
    }

    function construirConsultaCliente(fila) {
        if (fila.barcode) { return fila.barcode + " product bottle"; }
        return [fila.marca, fila.nombre, fila.presentacion, "bottle"].filter(Boolean).join(" ");
    }

    // ---------------------------------------------------------------------
    // Resumen + tabla de vista previa
    // ---------------------------------------------------------------------

    function renderizarResumenYPreview() {
        var validas = 0, advertencias = 0, errores = 0, existentes = 0;
        var categoriasFaltantes = new Set();

        filasValidadas.forEach(function (fila) {
            var estado = estadoFinalDeFila(fila);
            if (estado === "error") {
                errores++;
                fila.errores.forEach(function (mensaje) {
                    if (mensaje.indexOf("categoría") !== -1 && mensaje.indexOf("no existe") !== -1) {
                        categoriasFaltantes.add(fila.categoriaNombre);
                    }
                });
            } else if (estado === "existente") {
                existentes++;
            } else if (estado === "advertencia") {
                advertencias++;
            } else {
                validas++;
            }
        });

        document.getElementById("contValidas").textContent = validas;
        document.getElementById("contAdvertencias").textContent = advertencias;
        document.getElementById("contErrores").textContent = errores;
        document.getElementById("contExistentes").textContent = existentes;

        var importables = validas + advertencias;
        document.getElementById("resumenArchivo").textContent =
            "Archivo: " + ultimoNombreArchivo + " — " + filasValidadas.length + " filas encontradas. " +
            importables + " producto" + (importables === 1 ? "" : "s") + " se pueden importar.";

        var bloqueCategorias = document.getElementById("categoriasNoEncontradas");
        if (categoriasFaltantes.size > 0) {
            bloqueCategorias.hidden = false;
            bloqueCategorias.innerHTML = "<strong>Categorías no encontradas:</strong><br>" +
                Array.from(categoriasFaltantes).map(function (nombre) {
                    return "- " + escaparTexto(nombre);
                }).join("<br>");
        } else {
            bloqueCategorias.hidden = true;
        }

        var cuerpo = document.getElementById("cuerpoTablaPreview");
        cuerpo.innerHTML = "";

        filasValidadas.forEach(function (fila, indice) {
            cuerpo.appendChild(crearFilaPreview(fila, indice, estadoFinalDeFila(fila)));
        });

        var textoBoton = document.getElementById("textoBtnImportar");
        textoBoton.textContent = "Importar " + importables + " producto" + (importables === 1 ? "" : "s");
        document.getElementById("btnImportar").disabled = importables === 0;

        actualizarBloqueBusquedaFaltantes();

        document.getElementById("seccionResumen").hidden = false;
        document.getElementById("seccionResumen").scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function actualizarBloqueBusquedaFaltantes() {
        var bloque = document.getElementById("bloqueBusquedaFaltantes");
        var faltantes = filasValidadas.filter(filaElegibleParaBusqueda);
        var conImagen = filasValidadas.filter(function (fila) {
            return estadoFinalDeFila(fila) !== "error" && estadoFinalDeFila(fila) !== "existente" && fila.resolucionImagen.tipo !== "ninguna";
        }).length;

        if (!configuracionBusqueda.enabled || faltantes.length === 0) {
            bloque.hidden = true;
            return;
        }

        bloque.hidden = false;
        document.getElementById("resumenImagenesFaltantes").textContent =
            (conImagen + faltantes.length) + " productos a importar — " + conImagen + " con imagen, " + faltantes.length + " sin imagen.";
        document.getElementById("textoBtnBuscarFaltantes").textContent =
            "Buscar " + faltantes.length + " imagen" + (faltantes.length === 1 ? "" : "es") + " automáticamente";
        document.getElementById("btnBuscarFaltantes").disabled = buscandoImagenes;
    }

    function crearFilaPreview(fila, indice, estado) {
        var tr = document.createElement("tr");

        var mensajes = fila.errores.concat(fila.advertencias);
        if (estado === "existente") { mensajes = ["Producto ya existente (no se modificará)."]; }
        else if (fila.estadoDuplicado === "actualizar") { mensajes = ["Se actualizará el producto existente."].concat(mensajes); }

        var textoEstado = { valido: "✓ Válido", advertencia: "⚠ Advertencia", error: "✕ Error", existente: "● Ya existe" }[estado];

        var imagenHtml = "—";
        if (fila.resolucionImagen.tipo === "url") {
            imagenHtml = '<img class="admin-preview-miniatura" src="' + escaparAtributo(fila.resolucionImagen.valor) + '" alt="" loading="lazy" onerror="this.style.visibility=\'hidden\'">';
        } else if (fila.resolucionImagen.tipo === "busqueda") {
            var etiquetaConfianza = fila.resolucionImagen.confianza === "alta" ? "" : ' <span class="admin-badge-estado-fila advertencia">⚠ Revisar</span>';
            imagenHtml = '<img class="admin-preview-miniatura" src="' + escaparAtributo(fila.resolucionImagen.valor) + '" alt="" loading="lazy" onerror="this.style.visibility=\'hidden\'">' + etiquetaConfianza;
        }
        // Las miniaturas de imágenes dentro del ZIP se generan de forma
        // perezosa (ver más abajo) para no descomprimir cientos de archivos
        // de una sola vez solo para mostrar una vista previa.

        var puedeBuscarImagen = configuracionBusqueda.enabled && estado !== "error" && estado !== "existente";
        var accionesImagen = "";
        if (puedeBuscarImagen) {
            if (fila.resolucionImagen.tipo === "busqueda") {
                accionesImagen = '<div class="admin-preview-acciones-imagen"><button type="button" class="admin-boton-mini" data-accion="cambiar-imagen" data-indice="' + indice + '">Cambiar</button></div>';
            } else if (fila.resolucionImagen.tipo === "ninguna") {
                accionesImagen = '<div class="admin-preview-acciones-imagen"><button type="button" class="admin-boton-mini" data-accion="buscar-imagen" data-indice="' + indice + '">Buscar imagen</button></div>';
            }
        }

        var fuenteTexto = "—";
        if (fila.resolucionImagen.tipo === "busqueda") {
            fuenteTexto = NOMBRE_LEGIBLE_FUENTE[fila.resolucionImagen.fuente] || fila.resolucionImagen.fuente || "?";
        } else if (fila.resolucionImagen.tipo === "zip") {
            fuenteTexto = "ZIP";
        } else if (fila.resolucionImagen.tipo === "url") {
            fuenteTexto = "URL";
        }

        tr.innerHTML =
            "<td>" + (indice + 1) + "</td>" +
            '<td class="admin-preview-celda-imagen">' + imagenHtml + accionesImagen + "</td>" +
            "<td>" + escaparTexto(fila.codigo || "—") + "</td>" +
            "<td>" + escaparTexto(fila.nombre || "—") + "</td>" +
            "<td>" + escaparTexto(fila.categoriaNombre || "—") + "</td>" +
            "<td>" + (fila.precio != null ? "₡" + fila.precio.toLocaleString("es-CR") : "—") + "</td>" +
            "<td>" + (fila.stock != null ? fila.stock : "—") + "</td>" +
            "<td>" + escaparTexto(fuenteTexto) + "</td>" +
            '<td><span class="admin-badge-estado-fila ' + estado + '">' + textoEstado + "</span>" +
            (mensajes.length ? '<div class="admin-fila-mensajes">' + mensajes.map(escaparTexto).join("<br>") + "</div>" : "") +
            "</td>";

        if (fila.resolucionImagen.tipo === "zip") {
            var celdaImagen = tr.querySelector(".admin-preview-celda-imagen");
            fila.resolucionImagen.entrada.entry.async("blob").then(function (blob) {
                var blobTipado = new Blob([blob], { type: fila.resolucionImagen.entrada.mime });
                var url = URL.createObjectURL(blobTipado);
                celdaImagen.innerHTML = '<img class="admin-preview-miniatura" src="' + url + '" alt="">' + accionesImagen;
            }).catch(function () {
                celdaImagen.textContent = "—";
            });
        }

        var botonAccion = tr.querySelector('[data-accion="cambiar-imagen"], [data-accion="buscar-imagen"]');
        if (botonAccion) {
            botonAccion.addEventListener("click", function () {
                abrirDialogoCandidatos(indice);
            });
        }

        return tr;
    }

    function escaparTexto(texto) {
        var contenedor = document.createElement("div");
        contenedor.textContent = texto == null ? "" : String(texto);
        return contenedor.innerHTML;
    }

    function escaparAtributo(texto) {
        return escaparTexto(texto).replace(/"/g, "&quot;");
    }

    function formatearTamanio(bytes) {
        if (bytes < 1024 * 1024) { return Math.round(bytes / 1024) + " KB"; }
        return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    }

    // ---------------------------------------------------------------------
    // Imágenes: subida (ZIP y URL) reutilizando window.subirImagenAdmin
    // ---------------------------------------------------------------------

    function verificarFirmaImagen(bytes, mime) {
        if (bytes.length < 12) { return false; }
        if (mime === "image/jpeg") { return bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF; }
        if (mime === "image/png") { return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47; }
        if (mime === "image/webp") {
            return bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
                bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
        }
        return false;
    }

    async function subirImagenDesdeZip(resolucion, nombreBase) {
        var arrayBuffer = await resolucion.entrada.entry.async("arraybuffer");

        if (arrayBuffer.byteLength > MAX_TAMANIO_IMAGEN) {
            throw new Error("La imagen del ZIP supera el máximo permitido (8 MB).");
        }

        var bytes = new Uint8Array(arrayBuffer);
        if (!verificarFirmaImagen(bytes, resolucion.entrada.mime)) {
            throw new Error("El archivo de imagen no es válido (no coincide con su extensión).");
        }

        var blob = new Blob([arrayBuffer], { type: resolucion.entrada.mime });
        var resultado = await window.subirImagenAdmin("productos", blob, nombreBase);
        return resultado.url;
    }

    // Descarga y reprocesa la imagen por el mismo pipeline (WebP + resize +
    // Storage) cuando es posible. No hay backend que pueda hacer este fetch
    // de forma aislada/SSRF-segura: lo hace el propio navegador del admin, al
    // mismo nivel de confianza que si pegara la URL en la barra de
    // direcciones. Igual se bloquean hosts obviamente locales/privados como
    // defensa en profundidad. Si falla por cualquier motivo (CORS, timeout,
    // tipo no permitido, etc.) NO se aborta la fila: se conserva la URL tal
    // cual en `imagen`, exactamente como ya soporta el resto del sitio para
    // imágenes legacy/externas (ver admin-chrome.js:resolverRutaImagenAdmin).
    async function subirImagenDesdeUrl(urlTexto, nombreBase) {
        if (!validarUrlImagenPermitida(urlTexto)) {
            return { ok: false, motivo: "URL no permitida." };
        }

        var controlador = new AbortController();
        var idTimeout = setTimeout(function () { controlador.abort(); }, 10000);

        try {
            var respuesta = await fetch(urlTexto, {
                signal: controlador.signal,
                mode: "cors",
                credentials: "omit",
                redirect: "follow"
            });

            if (!respuesta.ok) { return { ok: false, motivo: "HTTP " + respuesta.status }; }

            var tipoContenido = (respuesta.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
            if (["image/jpeg", "image/png", "image/webp"].indexOf(tipoContenido) === -1) {
                return { ok: false, motivo: "Tipo de contenido no permitido (" + (tipoContenido || "desconocido") + ")." };
            }

            var buffer = await respuesta.arrayBuffer();
            if (buffer.byteLength > MAX_TAMANIO_IMAGEN) { return { ok: false, motivo: "Imagen demasiado grande." }; }

            var bytes = new Uint8Array(buffer);
            if (!verificarFirmaImagen(bytes, tipoContenido)) { return { ok: false, motivo: "El contenido no es una imagen válida." }; }

            var blob = new Blob([buffer], { type: tipoContenido });
            var resultado = await window.subirImagenAdmin("productos", blob, nombreBase);
            return { ok: true, url: resultado.url };
        } catch (error) {
            return { ok: false, motivo: error.name === "AbortError" ? "Tiempo de espera agotado." : (error.message || "Error de red.") };
        } finally {
            clearTimeout(idTimeout);
        }
    }

    // Resuelve la imagen final de una fila para la importación real (no la
    // vista previa): sube a Storage cuando corresponde y devuelve la URL a
    // guardar en `productos.imagen`, o null si no hay imagen para esa fila.
    async function resolverImagenParaImportar(fila, contadores) {
        var resolucion = fila.resolucionImagen;

        if (resolucion.tipo === "zip") {
            try {
                var url = await subirImagenDesdeZip(resolucion, fila.nombre);
                contadores.imagenesOk++;
                return url;
            } catch (error) {
                // Una imagen corrupta/inválida no debe bloquear la creación
                // del producto: se registra como advertencia y el producto
                // se importa sin imagen (o conservando la que ya tenía, en
                // una actualización).
                contadores.imagenesError++;
                fila.advertencias.push("Imagen: " + error.message);
                return fila.estadoDuplicado === "actualizar" ? undefined : null;
            }
        }

        if (resolucion.tipo === "url") {
            var resultadoUrl = await subirImagenDesdeUrl(resolucion.valor, fila.nombre);
            if (resultadoUrl.ok) {
                contadores.imagenesOk++;
                return resultadoUrl.url;
            }
            // No se pudo reprocesar: se conserva la URL original tal cual.
            fila.advertencias.push("Imagen por URL no se pudo optimizar (" + resultadoUrl.motivo + "); se usó el enlace original.");
            return resolucion.valor;
        }

        if (resolucion.tipo === "busqueda") {
            // §14: la imagen encontrada en internet SIEMPRE se descarga y se
            // reprocesa por el backend (mismo pipeline que una imagen
            // subida a mano) antes de guardarla — nunca se guarda la URL
            // externa tal cual, a diferencia del caso "url" de arriba.
            try {
                var resultadoBusqueda = await subirImagenDesdeBusqueda(resolucion.valor, fila.nombre);
                contadores.imagenesOk++;
                return resultadoBusqueda;
            } catch (error) {
                contadores.imagenesError++;
                fila.advertencias.push("No se pudo descargar la imagen encontrada automáticamente (" + error.message + "); se importó sin imagen.");
                return fila.estadoDuplicado === "actualizar" ? undefined : null;
            }
        }

        return fila.estadoDuplicado === "actualizar" ? undefined : null;
    }

    async function subirImagenDesdeBusqueda(url, nombreBase) {
        var token = await obtenerAccessToken();
        if (!token) { throw new Error("sesión inválida"); }

        var respuesta = await fetch("api/image-search/import-image", {
            method: "POST",
            headers: { "content-type": "application/json", authorization: "Bearer " + token },
            body: JSON.stringify({ url: url, nombreBase: nombreBase })
        });

        var cuerpo = await respuesta.json().catch(function () { return {}; });

        if (!respuesta.ok) {
            throw new Error(cuerpo.error || ("HTTP " + respuesta.status));
        }

        return cuerpo.url;
    }

    // ---------------------------------------------------------------------
    // Importación (batched)
    // ---------------------------------------------------------------------

    async function ejecutarImportacion() {
        if (importando) { return; }
        importando = true;

        var botonImportar = document.getElementById("btnImportar");
        var estadoImportando = document.getElementById("estadoImportando");
        botonImportar.disabled = true;
        estadoImportando.hidden = false;

        var filasAImportar = filasValidadas.filter(function (fila) {
            var estado = estadoFinalDeFila(fila);
            return estado === "valido" || estado === "advertencia";
        });

        console.log("[PRODUCT_IMPORT] started user=" + (window.adminUsuario && window.adminUsuario.email));
        console.log("[PRODUCT_IMPORT] rows=" + filasValidadas.length);

        var contadores = {
            creados: 0, actualizados: 0, omitidos: filasValidadas.length - filasAImportar.length -
                filasValidadas.filter(function (f) { return estadoFinalDeFila(f) === "error"; }).length,
            errores: 0, imagenesOk: 0, imagenesError: 0
        };
        var erroresDetalle = [];

        for (var inicio = 0; inicio < filasAImportar.length; inicio += CHUNK_TAMANIO) {
            var lote = filasAImportar.slice(inicio, inicio + CHUNK_TAMANIO);
            await procesarLote(lote, contadores, erroresDetalle);
        }

        // Filas que ya tenían error de validación (categoría inexistente,
        // precio inválido, etc.) también entran al reporte final.
        filasValidadas.forEach(function (fila) {
            if (estadoFinalDeFila(fila) === "error") {
                erroresDetalle.push({
                    fila: fila.numeroFila,
                    codigo: fila.codigo || "",
                    mensaje: fila.errores.join(" / ")
                });
                contadores.errores++;
            }
        });

        ultimoReporteErrores = erroresDetalle;

        console.log("[PRODUCT_IMPORT] created=" + contadores.creados + " updated=" + contadores.actualizados +
            " skipped=" + contadores.omitidos + " errors=" + contadores.errores);

        mostrarResultadoFinal(contadores, erroresDetalle);

        importando = false;
        estadoImportando.hidden = true;
        botonImportar.disabled = false;
    }

    async function procesarLote(lote, contadores, erroresDetalle) {
        // 1) Resolver imágenes con concurrencia limitada.
        var indice = 0;
        async function trabajador() {
            while (indice < lote.length) {
                var miIndice = indice++;
                var fila = lote[miIndice];
                fila._imagenResuelta = await resolverImagenParaImportar(fila, contadores);
            }
        }
        var trabajadores = [];
        for (var w = 0; w < CONCURRENCIA_IMAGENES; w++) { trabajadores.push(trabajador()); }
        await Promise.all(trabajadores);

        // 2) Separar creaciones de actualizaciones y armar payloads.
        var filasCrear = lote.filter(function (f) { return f.estadoDuplicado !== "actualizar"; });
        var filasActualizar = lote.filter(function (f) { return f.estadoDuplicado === "actualizar"; });

        if (filasCrear.length) {
            await intentarEscrituraLote(filasCrear, "insert", contadores, erroresDetalle);
        }
        if (filasActualizar.length) {
            await intentarEscrituraLote(filasActualizar, "upsert", contadores, erroresDetalle);
        }
    }

    function construirPayload(fila) {
        var payload = {
            nombre: fila.nombre,
            marca: fila.marca,
            presentacion: fila.presentacion,
            codigo: fila.codigo,
            descripcion: fila.descripcion,
            id_categoria: fila.idCategoria,
            precio: fila.precio,
            stock: fila.stock,
            disponible: fila.disponible,
            destacado: fila.destacado,
            promocion: fila.promocion,
            estado: fila.estado
        };

        if (fila._imagenResuelta !== undefined) {
            payload.imagen = fila._imagenResuelta;
        } else if (fila.estadoDuplicado === "actualizar") {
            payload.imagen = fila.imagenExistente || null;
        } else {
            payload.imagen = null;
        }

        if (fila.estadoDuplicado === "actualizar") {
            payload.id_producto = fila.idProductoExistente;
        }

        return payload;
    }

    async function intentarEscrituraLote(filas, modo, contadores, erroresDetalle) {
        var payloads = filas.map(construirPayload);

        var respuesta = modo === "insert"
            ? await window.supabaseClient.from("productos").insert(payloads).select("id_producto, codigo")
            : await window.supabaseClient.from("productos").upsert(payloads, { onConflict: "id_producto" }).select("id_producto, codigo");

        if (!respuesta.error) {
            if (modo === "insert") { contadores.creados += filas.length; }
            else { contadores.actualizados += filas.length; }

            (respuesta.data || []).forEach(function (fila_db, i) {
                guardarAtribucionSiCorresponde(fila_db.id_producto, filas[i]);
            });
            return;
        }

        console.error("[PRODUCT_IMPORT] fallo de lote, reintentando fila por fila", respuesta.error.message);

        // El lote completo falló (p. ej. una violación de constraint en una
        // sola fila hace fallar el INSERT/UPSERT multi-fila entero). Se
        // reintenta fila por fila para aislar exactamente cuál falló, sin
        // perder las que sí son válidas.
        for (var i = 0; i < filas.length; i++) {
            var fila = filas[i];
            var payload = construirPayload(fila);
            var respuestaFila = modo === "insert"
                ? await window.supabaseClient.from("productos").insert(payload).select("id_producto, codigo")
                : await window.supabaseClient.from("productos").upsert(payload, { onConflict: "id_producto" }).select("id_producto, codigo");

            if (respuestaFila.error) {
                erroresDetalle.push({ fila: fila.numeroFila, codigo: fila.codigo || "", mensaje: respuestaFila.error.message });
                contadores.errores++;

                // La fila no se creó/actualizó: si se había subido una
                // imagen nueva para ella, se limpia para no dejar huérfanos.
                if (fila._imagenResuelta && typeof window.eliminarImagenAdminSiEsDeStorage === "function") {
                    await window.eliminarImagenAdminSiEsDeStorage(fila._imagenResuelta).catch(function () {});
                }
            } else {
                if (modo === "insert") { contadores.creados++; }
                else { contadores.actualizados++; }

                // Actualización exitosa con imagen nueva: borrar la imagen
                // anterior de Storage (mismo criterio que producto-form.js).
                if (modo === "upsert" && fila._imagenResuelta && fila.imagenExistente &&
                    fila.imagenExistente !== fila._imagenResuelta && typeof window.eliminarImagenAdminSiEsDeStorage === "function") {
                    await window.eliminarImagenAdminSiEsDeStorage(fila.imagenExistente).catch(function () {});
                }

                var idProducto = respuestaFila.data && respuestaFila.data[0] && respuestaFila.data[0].id_producto;
                if (idProducto) { guardarAtribucionSiCorresponde(idProducto, fila); }
            }
        }
    }

    // §35/§36/§38: guarda fuente/licencia/autor de una imagen encontrada por
    // búsqueda automática, sin tocar la tabla `productos`. Best-effort: si
    // falla, no debe afectar el resultado de la importación (el producto ya
    // se creó/actualizó bien).
    function guardarAtribucionSiCorresponde(idProducto, fila) {
        var resolucion = fila.resolucionImagen;
        if (!resolucion || resolucion.tipo !== "busqueda" || !resolucion.fuente) { return; }

        window.supabaseClient
            .from("producto_imagen_atribucion")
            .upsert({
                id_producto: idProducto,
                fuente: resolucion.fuente,
                fuente_url: resolucion.sourceUrlGanador || null,
                licencia: resolucion.licencia || null,
                licencia_url: resolucion.licenciaUrl || null,
                autor: resolucion.autor || null
            }, { onConflict: "id_producto" })
            .then(function (respuesta) {
                if (respuesta.error) {
                    console.error("[PRODUCT_IMPORT] no se pudo guardar la atribución de imagen", respuesta.error.message);
                }
            });
    }

    // ---------------------------------------------------------------------
    // Resultado final
    // ---------------------------------------------------------------------

    function mostrarResultadoFinal(contadores, erroresDetalle) {
        document.getElementById("seccionResumen").hidden = true;
        document.getElementById("seccionResultado").hidden = false;

        document.getElementById("resProcesados").textContent = filasValidadas.length;
        document.getElementById("resCreados").textContent = contadores.creados;
        document.getElementById("resActualizados").textContent = contadores.actualizados;
        document.getElementById("resOmitidos").textContent = contadores.omitidos;
        document.getElementById("resErrores").textContent = contadores.errores;
        document.getElementById("resImgOk").textContent = contadores.imagenesOk;
        document.getElementById("resImgError").textContent = contadores.imagenesError;

        var bloqueErrores = document.getElementById("bloqueErroresResultado");
        var cuerpoErrores = document.getElementById("cuerpoTablaErrores");
        cuerpoErrores.innerHTML = "";

        if (erroresDetalle.length > 0) {
            bloqueErrores.hidden = false;
            erroresDetalle.forEach(function (error) {
                var tr = document.createElement("tr");
                tr.innerHTML = "<td>" + error.fila + "</td><td>" + escaparTexto(error.codigo || "—") + "</td><td>" + escaparTexto(error.mensaje) + "</td>";
                cuerpoErrores.appendChild(tr);
            });
        } else {
            bloqueErrores.hidden = true;
        }

        document.getElementById("seccionResultado").scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function descargarReporteErrores() {
        var csv = Papa.unparse({
            fields: ["fila", "codigo", "error"],
            data: ultimoReporteErrores.map(function (e) { return [e.fila, e.codigo, e.mensaje]; })
        });
        descargarBlob(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }), "errores-importacion-productos.csv");
    }

    // ---------------------------------------------------------------------
    // Selector de candidatos ("Cambiar" / "Buscar imagen" por fila) — §10/§11
    // ---------------------------------------------------------------------

    function configurarDialogoCandidatos() {
        var dialogo = document.getElementById("dialogCandidatos");

        document.getElementById("btnDialogCerrar").addEventListener("click", function () {
            dialogo.close();
        });

        document.getElementById("btnDialogSinImagen").addEventListener("click", function () {
            if (indiceDialogoActual === null) { return; }
            var fila = filasValidadas[indiceDialogoActual];
            fila.resolucionImagen = { tipo: "ninguna" };
            dialogo.close();
            renderizarResumenYPreview();
        });

        document.getElementById("btnDialogBuscarDeNuevo").addEventListener("click", async function () {
            if (indiceDialogoActual === null) { return; }
            await buscarDeNuevoEnDialogo(indiceDialogoActual);
        });
    }

    function abrirDialogoCandidatos(indice) {
        indiceDialogoActual = indice;
        var fila = filasValidadas[indice];
        var dialogo = document.getElementById("dialogCandidatos");

        document.getElementById("dialogCandidatosProducto").textContent =
            [fila.marca, fila.nombre, fila.presentacion].filter(Boolean).join(" · ");
        document.getElementById("dialogCandidatosQuery").value =
            fila.resolucionImagen.searchQuery || construirConsultaCliente(fila);
        document.getElementById("dialogCandidatosEstado").textContent = "";

        var candidatosPrevios = (fila.resolucionImagen.candidatos || fila.resolucionImagen.candidatosPrevios || []);
        renderizarCandidatosEnDialogo(candidatosPrevios, fila.resolucionImagen.valor || null);

        dialogo.showModal();
    }

    function renderizarCandidatosEnDialogo(candidatos, urlSeleccionadaActual) {
        var grid = document.getElementById("dialogCandidatosGrid");
        grid.innerHTML = "";

        if (candidatos.length === 0) {
            grid.innerHTML = '<p class="admin-ayuda">Sin candidatos todavía. Probá "Buscar de nuevo".</p>';
            return;
        }

        candidatos.forEach(function (candidato) {
            var celda = document.createElement("div");
            var esSeleccionado = candidato.url === urlSeleccionadaActual;
            celda.className = "admin-candidato" + (esSeleccionado ? " seleccionado" : "");
            var fuente = NOMBRE_LEGIBLE_FUENTE[candidato.fuente] || candidato.sourceDomain || "";
            celda.innerHTML =
                '<img src="' + escaparAtributo(candidato.thumbnail || candidato.url) + '" alt="" loading="lazy" onerror="this.style.opacity=\'.3\'">' +
                "<span>" + Math.round(candidato.score || 0) + "% " + (esSeleccionado ? "✓" : "") + "</span>" +
                "<span>" + escaparTexto(fuente) + "</span>";
            celda.addEventListener("click", function () {
                seleccionarCandidato(candidato, candidatos);
            });
            grid.appendChild(celda);
        });
    }

    function seleccionarCandidato(candidato, todosLosCandidatos) {
        if (indiceDialogoActual === null) { return; }
        var fila = filasValidadas[indiceDialogoActual];

        fila.resolucionImagen = {
            tipo: "busqueda",
            valor: candidato.url,
            candidatos: todosLosCandidatos,
            confianza: candidato.confianza || "media",
            searchQuery: document.getElementById("dialogCandidatosQuery").value,
            fuente: candidato.fuente || null,
            licencia: candidato.license || null,
            licenciaUrl: candidato.licenseUrl || null,
            autor: candidato.author || null,
            sourceUrlGanador: candidato.sourceUrl || null,
            autoSeleccionado: false
        };

        // Reemplazo manual: ya no hace falta la advertencia de "revisar",
        // el admin acaba de confirmar la imagen a ojo.
        fila.advertencias = fila.advertencias.filter(function (m) {
            return m.indexOf("revisar antes de importar") === -1 && m.indexOf("No se encontró una imagen confiable") === -1;
        });

        document.getElementById("dialogCandidatos").close();
        renderizarResumenYPreview();
    }

    async function buscarDeNuevoEnDialogo(indice) {
        var fila = filasValidadas[indice];
        var consulta = document.getElementById("dialogCandidatosQuery").value.trim();
        var estadoDialogo = document.getElementById("dialogCandidatosEstado");

        if (!consulta) { return; }

        estadoDialogo.textContent = "Buscando…";

        var token = await obtenerAccessToken();
        if (!token) {
            estadoDialogo.textContent = "Sesión inválida.";
            return;
        }

        try {
            var ultimoResultado = null;
            await llamarResolveSSE(token, {
                items: [{ indice: indice, nombre: fila.nombre, marca: fila.marca, presentacion: fila.presentacion, codigo: fila.codigo, barcode: fila.barcode }],
                forzar: true,
                consultaPersonalizada: consulta
            }, function (evento) {
                if (evento.tipo === "item") { ultimoResultado = evento.datos; }
            });

            if (!ultimoResultado) {
                estadoDialogo.textContent = "Sin respuesta del proveedor.";
                return;
            }

            estadoDialogo.textContent = ultimoResultado.candidatos.length + " candidatos encontrados.";
            renderizarCandidatosEnDialogo(ultimoResultado.candidatos || [], ultimoResultado.ganador ? ultimoResultado.ganador.url : null);

            // No se auto-selecciona nada acá: el admin elige a mano de la
            // grilla (por eso no se llama a aplicarResultadoBusqueda).
        } catch (error) {
            estadoDialogo.textContent = "Error: " + (error.message || "desconocido");
        }
    }

    // ---------------------------------------------------------------------
    // Botones
    // ---------------------------------------------------------------------

    function configurarBotones() {
        document.getElementById("btnValidarArchivo").addEventListener("click", validarArchivos);
        document.getElementById("btnBuscarFaltantes").addEventListener("click", buscarImagenesFaltantes);
        document.getElementById("btnImportar").addEventListener("click", ejecutarImportacion);
        document.getElementById("btnCancelarImportacion").addEventListener("click", function () {
            ocultarSeccionesResultado();
        });
        document.getElementById("btnDescargarErrores").addEventListener("click", descargarReporteErrores);
        document.getElementById("btnImportarOtro").addEventListener("click", function () {
            window.location.reload();
        });
    }

    // Ganchos de solo lectura para el test unitario en Node (ver
    // productos-importar.test.js). No se usan en producción: el panel admin
    // nunca lee `window.__productosImportarTestHooks`.
    if (typeof window !== "undefined") {
        window.__productosImportarTestHooks = {
            parseNumeroLatino: parseNumeroLatino,
            parseBooleano: parseBooleano,
            normalizarTexto: normalizarTexto,
            obtenerNombreBase: obtenerNombreBase,
            contienePathTraversal: contienePathTraversal,
            esUrlHttp: esUrlHttp,
            validarUrlImagenPermitida: validarUrlImagenPermitida,
            verificarFirmaImagen: verificarFirmaImagen,
            procesarZip: procesarZip,
            leerCsv: leerCsv,
            validarFila: validarFila,
            resolverImagenFila: resolverImagenFila,
            estadoFinalDeFila: estadoFinalDeFila,
            resolverDuplicadosPorCodigo: resolverDuplicadosPorCodigo,
            setCategorias: function (lista) {
                categoriasDisponibles = lista;
                mapaCategoriasNormalizadas = new Map();
                lista.forEach(function (categoria) {
                    mapaCategoriasNormalizadas.set(normalizarTexto(categoria.nombre), categoria);
                });
            },
            setMapaImagenesZip: function (mapa) { mapaImagenesZip = mapa; }
        };
    }
})();
