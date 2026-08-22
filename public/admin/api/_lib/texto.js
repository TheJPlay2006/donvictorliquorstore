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
    const matchLitros = normalizado.match(/(\d+(?:\.\d+)?)\s*l\b/);
    if (matchLitros) { return Math.round(parseFloat(matchLitros[1]) * 1000); }
    const matchMl = normalizado.match(/(\d+(?:\.\d+)?)\s*(?:ml|cc)\b/);
    if (matchMl) { return Math.round(parseFloat(matchMl[1])); }
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

// Máximo 3 variantes de consulta, sin duplicados, para no golpear los
// proveedores con decenas de queries por producto (§14).
function generarVariantesConsulta(producto) {
    const base = nombreCompleto(producto);
    const baseNormalizada = normalizarTexto(base);
    const presentacion = String(producto.presentacion || "").trim();
    const palabraTipo = palabraCategoria(producto.categoria);
    // Evita "Absolut Vodka vodka bottle": si la palabra de categoría ya
    // aparece en el nombre, no se repite.
    const palabraTipoUtil = palabraTipo && baseNormalizada.indexOf(palabraTipo) === -1 ? palabraTipo : null;

    const candidatas = [];
    if (presentacion) { candidatas.push((base + " " + presentacion + " bottle").trim()); }
    if (palabraTipoUtil) { candidatas.push((base + " " + palabraTipoUtil + " bottle").trim()); }
    candidatas.push((base + " bottle").trim());
    candidatas.push((base + " product").trim());

    const vistas = new Set();
    const resultado = [];
    for (let i = 0; i < candidatas.length && resultado.length < 3; i++) {
        const normalizada = normalizarTexto(candidatas[i]);
        if (!normalizada || vistas.has(normalizada)) { continue; }
        vistas.add(normalizada);
        resultado.push(candidatas[i].replace(/\s+/g, " ").trim());
    }
    return resultado;
}

module.exports = {
    normalizarTexto,
    tokenizar,
    presentacionAMililitros,
    nombreCompleto,
    generarVariantesConsulta,
    palabraCategoria
};
