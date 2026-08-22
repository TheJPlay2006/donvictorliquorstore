// Normalización de texto para matching (§16) y generación de variantes de
// consulta (§13/§14) para los proveedores gratuitos de búsqueda de imagen.
"use strict";

// Categoría (nombre de columna `categoria` del CSV, en español) -> palabra
// en inglés útil para la consulta ("bottle" ya se agrega aparte). Ayuda a
// producir queries como "Johnnie Walker Black Label whisky bottle" en vez de
// depender solo del nombre. No es una lista cerrada: si la categoría no
// matchea nada, simplemente no se agrega esta palabra extra.
const PALABRA_INGLESA_POR_CATEGORIA = [
    [/whisky|whiskey|bourbon/i, "whisky"],
    [/vodka/i, "vodka"],
    [/ron\b/i, "rum"],
    [/gin|ginebra/i, "gin"],
    [/tequila|mezcal/i, "tequila"],
    [/cerveza/i, "beer"],
    [/vino|espumante/i, "wine"],
    [/licor|crema|aperitivo/i, "liqueur"]
];

// Alias ES→EN (§11): muchos nombres están en español pero las fotos en
// Internet suelen estar indexadas en inglés. Cada entrada reemplaza el
// patrón por la alternativa SOLO para generar una variante de consulta
// adicional — nunca se modifica el nombre real del producto.
const ALIASES_CONSULTA = [
    [/\b(\d{1,2})\s*a[nñ]os?\b/gi, "$1 years"],
    [/\ba[nñ]ejo\b/gi, "anejo"],
    [/\bcarta\s+oro\b/gi, "gold"],
    [/\bcarta\s+blanca\b/gi, "white"],
    [/\bblanco\b/gi, "silver"]
];

function normalizarTexto(texto) {
    return String(texto == null ? "" : texto)
        .replace(/['’]/g, "") // Jack Daniel's -> Jack Daniels (antes de quitar tildes/signos)
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "") // quita tildes/diacríticos
        .toLowerCase()
        .replace(/[^a-z0-9\s.]/g, " ") // conserva números y puntos (750.5 ml), quita el resto de puntuación
        .replace(/\s+/g, " ")
        .trim();
}

function tokenizar(texto) {
    return normalizarTexto(texto).split(" ").filter((t) => t.length >= 2);
}

// "750ml" / "750 ml" / "0,75 l" / "1 L" -> mililitros normalizados, para que
// "750 ml" y "0.75L" se reconozcan como la misma presentación. Devuelve null
// si no se puede interpretar.
function presentacionAMililitros(texto) {
    const normalizado = normalizarTexto(texto).replace(",", ".");
    const matchCl = normalizado.match(/(\d+(?:\.\d+)?)\s*cl\b/);
    if (matchCl) { return Math.round(parseFloat(matchCl[1]) * 10); }
    const matchLitros = normalizado.match(/(\d+(?:\.\d+)?)\s*l\b/);
    if (matchLitros) { return Math.round(parseFloat(matchLitros[1]) * 1000); }
    const matchMl = normalizado.match(/(\d+(?:\.\d+)?)\s*ml\b/);
    if (matchMl) { return Math.round(parseFloat(matchMl[1])); }
    return null;
}

// Extrae un "número de edad/añejamiento" (12 años, 12 years, aged 12,
// reserva 12...) del texto, o null si no hay ninguno. Deliberadamente NO
// captura números de presentación (750/700/1000): exige que el número esté
// pegado a una palabra de "años" en alguno de los dos idiomas, así "1800
// Reposado" (una marca que se llama "1800") nunca se confunde con una edad.
//
// `marca`, si se pasa, se usa para descartar un número final "suelto" que en
// realidad es parte del nombre de la marca (ej. "1800 Reposado").
function extraerNumeroEdad(texto, marca) {
    const normalizado = normalizarTexto(texto);
    const conAnos = normalizado.match(/\b(\d{1,2})\s*(?:anos|years?|yrs?|yo)\b/);
    if (conAnos) { return Number(conAnos[1]); }
    const antesDeNumero = normalizado.match(/\b(?:aged|reserva|reserve)\s*(\d{1,2})\b/);
    if (antesDeNumero) { return Number(antesDeNumero[1]); }

    // Fallback: número suelto al final del nombre (ej. "Flor de Caña 12"),
    // solo si está en un rango plausible de añejamiento y no es en realidad
    // parte del nombre de la marca.
    const alFinal = normalizado.match(/\b(\d{1,2})$/);
    if (alFinal) {
        const numero = Number(alFinal[1]);
        const marcaNormalizada = normalizarTexto(marca || "");
        const esPartedeMarca = marcaNormalizada && new RegExp("\\b" + numero + "\\b").test(marcaNormalizada);
        if (numero >= 3 && numero <= 30 && !esPartedeMarca) { return numero; }
    }
    return null;
}

// Arma "marca + nombre" sin duplicar la marca cuando el nombre ya la incluye
// (ej. marca="Johnnie Walker", nombre="Johnnie Walker Black Label" no debe
// dar "Johnnie Walker Johnnie Walker Black Label").
function nombreCompleto(producto) {
    const marca = String(producto.marca || "").trim();
    const nombre = String(producto.nombre || "").trim();

    if (!marca) { return nombre; }
    if (!nombre) { return marca; }

    const nombreNormalizado = normalizarTexto(nombre);
    const marcaNormalizada = normalizarTexto(marca);

    if (marcaNormalizada && nombreNormalizado.indexOf(marcaNormalizada) === 0) {
        return nombre;
    }
    return marca + " " + nombre;
}

function palabraCategoria(categoria) {
    const texto = String(categoria || "");
    for (let i = 0; i < PALABRA_INGLESA_POR_CATEGORIA.length; i++) {
        if (PALABRA_INGLESA_POR_CATEGORIA[i][0].test(texto)) {
            return PALABRA_INGLESA_POR_CATEGORIA[i][1];
        }
    }
    return null;
}

// Aplica los alias ES→EN a un texto y devuelve la variante traducida, o null
// si ningún alias aplicó (para no generar una "variante" idéntica al original).
function aplicarAliases(texto) {
    let resultado = texto;
    let cambio = false;
    ALIASES_CONSULTA.forEach(([patron, reemplazo]) => {
        const nuevo = resultado.replace(patron, reemplazo);
        if (nuevo !== resultado) { cambio = true; resultado = nuevo; }
    });
    return cambio ? resultado : null;
}

function agregarSinDuplicar(lista, vistos, candidata, limite) {
    if (lista.length >= limite) { return; }
    const normalizada = normalizarTexto(candidata);
    if (!normalizada || vistos.has(normalizada)) { return; }
    vistos.add(normalizada);
    lista.push(candidata.replace(/\s+/g, " ").trim());
}

// Variantes de consulta (§13/§14). Modo normal: hasta 3, igual que antes.
// Modo profundo (§10/§29/§30): hasta 6, agregando alias ES→EN, una consulta
// "product official" (para priorizar fuentes de fabricante) y, como última
// expansión, un hint regional (§30) — solo cuando ninguna de las anteriores
// bastó, nunca como primera opción.
function generarVariantesConsulta(producto, opciones) {
    const profundo = !!(opciones && opciones.profundo);
    const base = nombreCompleto(producto);
    const baseNormalizada = normalizarTexto(base);
    const presentacion = String(producto.presentacion || "").trim();
    const palabraTipo = palabraCategoria(producto.categoria);
    const palabraTipoUtil = palabraTipo && baseNormalizada.indexOf(palabraTipo) === -1 ? palabraTipo : null;

    const candidatas = [];
    if (presentacion) { candidatas.push(base + " " + presentacion + " bottle"); }
    if (palabraTipoUtil) { candidatas.push(base + " " + palabraTipoUtil + " bottle"); }
    candidatas.push(base + " bottle");
    candidatas.push(base + " product");

    if (profundo) {
        const baseAlias = aplicarAliases(base);
        if (baseAlias) {
            if (presentacion) { candidatas.push(baseAlias + " " + presentacion + " bottle"); }
            candidatas.push(baseAlias + " bottle");
        }
        if (palabraTipoUtil) { candidatas.push(base + " " + palabraTipoUtil + " official"); }
        candidatas.push(base + " Costa Rica bottle");
    }

    const vistos = new Set();
    const resultado = [];
    const limite = profundo ? 6 : 3;
    candidatas.forEach((candidata) => agregarSinDuplicar(resultado, vistos, candidata, limite));
    return resultado;
}

module.exports = {
    normalizarTexto,
    tokenizar,
    presentacionAMililitros,
    extraerNumeroEdad,
    nombreCompleto,
    generarVariantesConsulta,
    aplicarAliases,
    palabraCategoria
};
