// Equivalente server-side del pipeline de imágenes del navegador
// (js/admin/storage.js: validar → redimensionar a máx. 900px → WebP calidad
// .85 → subir a Storage → URL pública). Un Vercel Function no tiene <canvas>,
// así que acá se usa `sharp` para lograr el mismo resultado; el contrato de
// salida (WebP, mismo lado máximo, misma calidad, mismo bucket) es idéntico.
"use strict";

const sharp = require("sharp");
const crypto = require("node:crypto");

const LADO_MAXIMO_PX = 900;
const CALIDAD_WEBP = 85;
const DIMENSION_MINIMA_PX = 150; // por debajo de esto, probablemente es un ícono/miniatura, no una foto de producto

function slugificar(texto) {
    return String(texto || "")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "imagen";
}

async function convertirAWebp(buffer) {
    const imagen = sharp(buffer, { failOn: "none" });
    const metadata = await imagen.metadata();

    if (!metadata.width || !metadata.height) {
        throw new Error("No se pudo leer la imagen (archivo corrupto o formato no soportado).");
    }
    if (metadata.width < DIMENSION_MINIMA_PX || metadata.height < DIMENSION_MINIMA_PX) {
        throw new Error("La imagen es demasiado pequeña (" + metadata.width + "x" + metadata.height + "px), probablemente un ícono o miniatura.");
    }

    return imagen
        .resize({ width: LADO_MAXIMO_PX, height: LADO_MAXIMO_PX, fit: "inside", withoutEnlargement: true })
        .webp({ quality: CALIDAD_WEBP })
        .toBuffer();
}

// Sube al mismo bucket/convención que subirImagenAdmin() en el navegador:
// nombre = uuid + slug (nunca el nombre/URL original), nunca upsert.
async function subirImagenAdmin(clienteSupabase, bucket, buffer, nombreBase) {
    const bufferWebp = await convertirAWebp(buffer);
    const ruta = crypto.randomUUID() + "-" + slugificar(nombreBase) + ".webp";

    const { error } = await clienteSupabase.storage
        .from(bucket)
        .upload(ruta, bufferWebp, { contentType: "image/webp", upsert: false });

    if (error) {
        throw error;
    }

    const { data } = clienteSupabase.storage.from(bucket).getPublicUrl(ruta);
    return { url: data.publicUrl, bucket: bucket, ruta: ruta };
}

module.exports = { convertirAWebp, subirImagenAdmin, slugificar, LADO_MAXIMO_PX, DIMENSION_MINIMA_PX };
