// Subida de imágenes a Supabase Storage para el panel admin. Valida tipo y
// tamaño, convierte a WebP y redimensiona a máx. 900x900 (proporcional) en
// el navegador vía canvas, sube con un nombre generado (uuid + slug, nunca
// el nombre original) y devuelve la URL pública para guardar en la columna
// `imagen` (misma columna que ya usan las páginas públicas — funciona igual
// con una ruta estática legacy o con una URL de Storage).

var TIPOS_PERMITIDOS = ["image/jpeg", "image/png", "image/webp"];
var TAMANIO_MAXIMO_BYTES = 8 * 1024 * 1024;
var LADO_MAXIMO_PX = 900;

function slugificar(texto) {
    return String(texto || "")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "imagen";
}

function validarArchivo(archivo) {
    if (!archivo) {
        throw new Error("No se seleccionó ningún archivo.");
    }
    if (!TIPOS_PERMITIDOS.includes(archivo.type)) {
        throw new Error("Formato no permitido. Usá JPEG, PNG o WebP (no SVG).");
    }
    if (archivo.size > TAMANIO_MAXIMO_BYTES) {
        throw new Error("La imagen pesa demasiado (máximo 8 MB).");
    }
}

function convertirAWebP(archivo) {
    return new Promise(function (resolve, reject) {
        var lector = new FileReader();

        lector.onerror = function () {
            reject(new Error("No se pudo leer el archivo."));
        };

        lector.onload = function () {
            var imagen = new Image();

            imagen.onerror = function () {
                reject(new Error("El archivo no es una imagen válida."));
            };

            imagen.onload = function () {
                var escala = Math.min(
                    1,
                    LADO_MAXIMO_PX / Math.max(imagen.width, imagen.height)
                );
                var ancho = Math.round(imagen.width * escala);
                var alto = Math.round(imagen.height * escala);

                var lienzo = document.createElement("canvas");
                lienzo.width = ancho;
                lienzo.height = alto;
                lienzo.getContext("2d").drawImage(imagen, 0, 0, ancho, alto);

                lienzo.toBlob(
                    function (blob) {
                        if (!blob) {
                            reject(new Error("No se pudo convertir la imagen a WebP."));
                            return;
                        }
                        resolve(blob);
                    },
                    "image/webp",
                    0.85
                );
            };

            imagen.src = lector.result;
        };

        lector.readAsDataURL(archivo);
    });
}

// bucket: "productos" | "categorias". nombreBase: nombre del producto o
// categoría, solo para armar un nombre de archivo legible (no se usa tal
// cual, se combina con un uuid para evitar colisiones y nombres predecibles).
window.subirImagenAdmin = async function (bucket, archivo, nombreBase) {
    validarArchivo(archivo);

    var blobWebp = await convertirAWebP(archivo);
    var ruta = crypto.randomUUID() + "-" + slugificar(nombreBase) + ".webp";

    var { error } = await window.supabaseClient.storage
        .from(bucket)
        .upload(ruta, blobWebp, { contentType: "image/webp", upsert: false });

    if (error) {
        throw error;
    }

    var { data } = window.supabaseClient.storage.from(bucket).getPublicUrl(ruta);

    return { url: data.publicUrl, bucket: bucket, ruta: ruta };
};

// Borra un objeto de Storage solo si `urlImagen` efectivamente apunta a
// nuestro Storage (las imágenes legacy son rutas estáticas como
// "img/productos/foo.jpg" y se dejan intactas). Pensado para llamarse
// DESPUÉS de confirmar que la fila en la base ya se actualizó con la imagen
// nueva, nunca antes.
window.eliminarImagenAdminSiEsDeStorage = async function (urlImagen) {
    if (!urlImagen) {
        return;
    }

    var prefijo = window.SUPABASE_URL + "/storage/v1/object/public/";

    if (!urlImagen.startsWith(prefijo)) {
        return;
    }

    var resto = urlImagen.slice(prefijo.length);
    var separador = resto.indexOf("/");

    if (separador === -1) {
        return;
    }

    var bucket = resto.slice(0, separador);
    var ruta = resto.slice(separador + 1);

    await window.supabaseClient.storage.from(bucket).remove([ruta]);
};
