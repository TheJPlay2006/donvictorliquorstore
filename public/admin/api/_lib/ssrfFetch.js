// Descarga de imágenes externas con protecciones anti-SSRF, para las
// imágenes encontradas por búsqueda automática (ver
// api/image-search/import-image.js). Corre en el backend (Vercel Function),
// nunca en el navegador, precisamente para poder controlar esto con rigor.
"use strict";

const dns = require("node:dns").promises;

const TIPOS_PERMITIDOS = ["image/jpeg", "image/png", "image/webp"];
const TAMANIO_MAXIMO_BYTES = 8 * 1024 * 1024;
const TIMEOUT_MS = 8000;
const MAX_REDIRECCIONES = 3;

class ErrorDescargaImagen extends Error {}

function esIpPrivadaOEspecial(ip) {
    // IPv4
    if (ip.indexOf(".") !== -1) {
        const partes = ip.split(".").map(Number);
        if (partes.length !== 4 || partes.some((n) => Number.isNaN(n))) { return true; }
        const [a, b] = partes;
        if (a === 127) { return true; } // loopback
        if (a === 10) { return true; } // 10.0.0.0/8
        if (a === 172 && b >= 16 && b <= 31) { return true; } // 172.16.0.0/12
        if (a === 192 && b === 168) { return true; } // 192.168.0.0/16
        if (a === 169 && b === 254) { return true; } // link-local, incluye metadata cloud (169.254.169.254 / .170.2)
        if (a === 0) { return true; }
        if (a === 100 && b === 100 && partes[2] === 100 && partes[3] === 200) { return true; } // metadata Alibaba Cloud
        return false;
    }

    // IPv6
    const normalizado = ip.toLowerCase();
    if (normalizado === "::1") { return true; } // loopback
    if (normalizado.startsWith("fe80:")) { return true; } // link-local
    if (normalizado.startsWith("fc") || normalizado.startsWith("fd")) { return true; } // unique local (fc00::/7)
    if (normalizado.startsWith("::ffff:")) {
        // IPv4-mapped: reevaluar la parte v4.
        return esIpPrivadaOEspecial(normalizado.replace("::ffff:", ""));
    }
    return false;
}

async function validarUrlPublica(urlTexto) {
    let url;
    try {
        url = new URL(urlTexto);
    } catch (error) {
        throw new ErrorDescargaImagen("URL inválida.");
    }

    if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new ErrorDescargaImagen("Solo se permiten URLs http/https.");
    }

    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host === "metadata.google.internal" || host.endsWith(".internal")) {
        throw new ErrorDescargaImagen("Host no permitido.");
    }

    // Resuelve DNS y valida las IPs reales (no solo el hostname literal),
    // para no confiar únicamente en cómo se ve el string de la URL. Nota:
    // esto valida en el momento de la resolución; queda un margen residual
    // de TOCTOU/DNS rebinding entre esta resolución y la conexión real hecha
    // por fetch(), que no se elimina del todo sin fijar manualmente la IP en
    // el socket (fuera de alcance con las APIs estándar de fetch/undici).
    let direcciones;
    try {
        direcciones = await dns.lookup(host, { all: true });
    } catch (error) {
        throw new ErrorDescargaImagen("No se pudo resolver el host.");
    }

    if (direcciones.length === 0 || direcciones.some((d) => esIpPrivadaOEspecial(d.address))) {
        throw new ErrorDescargaImagen("El host resuelve a una dirección no permitida.");
    }

    return url;
}

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

async function leerConLimite(respuesta, maximoBytes) {
    const lector = respuesta.body.getReader();
    const trozos = [];
    let total = 0;

    for (;;) {
        const { done, value } = await lector.read();
        if (done) { break; }
        total += value.byteLength;
        if (total > maximoBytes) {
            await lector.cancel().catch(() => {});
            throw new ErrorDescargaImagen("La imagen supera el tamaño máximo permitido (8 MB).");
        }
        trozos.push(value);
    }

    return Buffer.concat(trozos.map((t) => Buffer.from(t)));
}

// Descarga una URL externa de forma segura: valida esquema/host/IP (bloquea
// localhost, loopback, redes privadas y endpoints de metadata cloud), sigue
// redirecciones manualmente re-validando cada salto, aplica timeout y límite
// de tamaño, y verifica que el contenido sea realmente una imagen JPEG/PNG/
// WebP (Content-Type + magic bytes, nunca solo la extensión).
async function descargarImagenSegura(urlOriginal) {
    let urlActual = await validarUrlPublica(urlOriginal);

    for (let salto = 0; salto <= MAX_REDIRECCIONES; salto++) {
        const controlador = new AbortController();
        const idTimeout = setTimeout(() => controlador.abort(), TIMEOUT_MS);

        let respuesta;
        try {
            respuesta = await fetch(urlActual, {
                method: "GET",
                redirect: "manual",
                signal: controlador.signal,
                headers: { "user-agent": "DonVictorLiquorStore-ImportBot/1.0" }
            });
        } catch (error) {
            throw new ErrorDescargaImagen(error.name === "AbortError" ? "Tiempo de espera agotado." : "Error de red al descargar la imagen.");
        } finally {
            clearTimeout(idTimeout);
        }

        if (respuesta.status >= 300 && respuesta.status < 400 && respuesta.headers.get("location")) {
            if (salto === MAX_REDIRECCIONES) {
                throw new ErrorDescargaImagen("Demasiadas redirecciones.");
            }
            const siguiente = new URL(respuesta.headers.get("location"), urlActual);
            urlActual = await validarUrlPublica(siguiente.toString());
            continue;
        }

        if (!respuesta.ok) {
            throw new ErrorDescargaImagen("El servidor respondió " + respuesta.status + " al descargar la imagen.");
        }

        const tipoContenido = (respuesta.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
        if (TIPOS_PERMITIDOS.indexOf(tipoContenido) === -1) {
            throw new ErrorDescargaImagen("Tipo de contenido no permitido (" + (tipoContenido || "desconocido") + ").");
        }

        const contentLength = Number(respuesta.headers.get("content-length"));
        if (contentLength && contentLength > TAMANIO_MAXIMO_BYTES) {
            throw new ErrorDescargaImagen("La imagen supera el tamaño máximo permitido (8 MB).");
        }

        const buffer = await leerConLimite(respuesta, TAMANIO_MAXIMO_BYTES);

        if (!verificarFirmaImagen(buffer, tipoContenido)) {
            throw new ErrorDescargaImagen("El contenido descargado no es una imagen válida.");
        }

        return { buffer: buffer, contentType: tipoContenido };
    }

    throw new ErrorDescargaImagen("Demasiadas redirecciones.");
}

module.exports = { descargarImagenSegura, validarUrlPublica, esIpPrivadaOEspecial, verificarFirmaImagen, ErrorDescargaImagen };
