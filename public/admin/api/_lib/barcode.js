// Validación de barcode/EAN/UPC/GTIN. El `codigo` interno de la tienda
// (ej. "JW-BLACK-750") NUNCA debe tratarse como si fuera un barcode — por
// eso esto exige que sea puramente numérico, de una longitud estándar, y
// que pase el dígito de control (check digit) real del estándar GS1.
"use strict";

// EAN-8 (8), UPC-A/GTIN-12 (12), EAN-13/GTIN-13 (13), GTIN-14 (14).
const LONGITUDES_VALIDAS = [8, 12, 13, 14];

// Dígito de control GS1: se pondera cada dígito alternando 1 y 3 desde la
// derecha (sin contar el propio check digit), y el resultado debe hacer que
// la suma sea múltiplo de 10.
function checkDigitValido(digitos) {
    const cuerpo = digitos.slice(0, -1);
    const checkDigit = Number(digitos[digitos.length - 1]);

    let suma = 0;
    for (let i = 0; i < cuerpo.length; i++) {
        const posicionDesdeElFinal = cuerpo.length - i; // 1-indexed desde la derecha
        const peso = posicionDesdeElFinal % 2 === 1 ? 3 : 1;
        suma += Number(cuerpo[i]) * peso;
    }

    const calculado = (10 - (suma % 10)) % 10;
    return calculado === checkDigit;
}

// Devuelve el barcode normalizado (solo dígitos) si es válido, o null.
function validarBarcode(valorOriginal) {
    const texto = String(valorOriginal == null ? "" : valorOriginal).trim();
    if (!texto) { return null; }
    if (!/^\d+$/.test(texto)) { return null; }
    if (LONGITUDES_VALIDAS.indexOf(texto.length) === -1) { return null; }
    if (!checkDigitValido(texto)) { return null; }
    return texto;
}

module.exports = { validarBarcode, checkDigitValido };
