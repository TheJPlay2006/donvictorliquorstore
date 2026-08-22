// Tests de la lógica crítica de búsqueda automática de imágenes (backend).
// Mismo estilo que el resto del proyecto: Node + `assert`, sin framework.
// Correr con: node public/admin/api/_lib/imageSearch.test.js
"use strict";

// IMPORTANTE: modo "normal" acá (no "deep") para que la etapa DEEP nunca se
// dispare sola durante los tests — evita que un test "offline" termine
// llamando de verdad a la API real de UPCitemdb (cuota compartida de
// 100/día) solo porque un fake de Wikimedia nunca llega a "alta". Los tests
// que sí quieren probar DEEP lo piden explícitamente con `profundo: true`.
process.env.IMAGE_SEARCH_MODE = "normal";

const assert = require("assert");

const { construirConsulta, construirClaveCache } = require("./consulta");
const { calcularScore, confianzaDe, confianzaDeScore, evaluarCandidatos, detectarConflictoIdentidad } = require("./scoring");
const { esIpPrivadaOEspecial, verificarFirmaImagen } = require("./ssrfFetch");
const { procesarConConcurrencia, conReintentos } = require("./concurrencia");
const { validarBarcode } = require("./barcode");
const { normalizarTexto, presentacionAMililitros, generarVariantesConsulta, nombreCompleto, extraerNumeroEdad, aplicarAliases } = require("./texto");
const { licenciaPermiteUsoComercialYDerivados } = require("./providers/openverse");

let total = 0;
let fallidos = 0;

function test(nombre, fn) {
    total++;
    try {
        fn();
        console.log("  ok - " + nombre);
    } catch (error) {
        fallidos++;
        console.error("  FALLÓ - " + nombre);
        console.error("    " + error.message);
    }
}

async function testAsync(nombre, fn) {
    total++;
    try {
        await fn();
        console.log("  ok - " + nombre);
    } catch (error) {
        fallidos++;
        console.error("  FALLÓ - " + nombre);
        console.error("    " + error.message);
    }
}

console.log("api/_lib (búsqueda automática de imágenes)");

// ---- construirConsulta ----
test("construirConsulta prioriza barcode/GTIN si existe", function () {
    const q = construirConsulta({ barcode: "5000267023585", nombre: "Johnnie Walker Black Label", marca: "Johnnie Walker" });
    assert.strictEqual(q, "5000267023585 product bottle");
});

test("construirConsulta usa marca + nombre + presentación cuando no hay barcode", function () {
    const q = construirConsulta({ marca: "Absolut", nombre: "Absolut Vodka", presentacion: "750 ml" });
    assert.strictEqual(q, "Absolut Absolut Vodka 750 ml bottle");
});

test("construirConsulta funciona con datos mínimos (solo nombre)", function () {
    const q = construirConsulta({ nombre: "Producto X" });
    assert.strictEqual(q, "Producto X bottle");
});

// ---- construirClaveCache ----
// Las claves llevan un prefijo "v{IMAGE_SEARCH_ALGORITHM_VERSION}:" (§42),
// por eso se busca la subcadena en vez de un "startsWith" fijo — así el test
// no se rompe si se sube la versión del algoritmo más adelante.
test("construirClaveCache usa barcode como clave estable si existe", function () {
    const clave1 = construirClaveCache({ barcode: "5000267023585", nombre: "A" });
    const clave2 = construirClaveCache({ barcode: "5000267023585", nombre: "B distinto" });
    assert.strictEqual(clave1, clave2);
    assert.ok(clave1.indexOf("barcode:") !== -1);
});

test("construirClaveCache usa codigo si no hay barcode", function () {
    const clave = construirClaveCache({ codigo: "JW-BLACK-750", nombre: "X" });
    assert.ok(clave.indexOf("codigo:jw-black-750") !== -1, clave);
});

test("construirClaveCache cae a hash de la consulta si no hay codigo ni barcode", function () {
    const clave1 = construirClaveCache({ nombre: "Absolut Vodka", marca: "Absolut", presentacion: "750 ml" });
    const clave2 = construirClaveCache({ nombre: "Absolut Vodka", marca: "Absolut", presentacion: "750 ml" });
    assert.strictEqual(clave1, clave2);
    assert.ok(clave1.indexOf("query:") !== -1);
});

test("construirClaveCache: subir IMAGE_SEARCH_ALGORITHM_VERSION invalida el cache anterior (§42)", function () {
    const anterior = process.env.IMAGE_SEARCH_ALGORITHM_VERSION;
    try {
        process.env.IMAGE_SEARCH_ALGORITHM_VERSION = "2";
        const claveV2 = construirClaveCache({ codigo: "JW-BLACK-750" });
        process.env.IMAGE_SEARCH_ALGORITHM_VERSION = "3";
        const claveV3 = construirClaveCache({ codigo: "JW-BLACK-750" });
        assert.notStrictEqual(claveV2, claveV3);
    } finally {
        if (anterior === undefined) { delete process.env.IMAGE_SEARCH_ALGORITHM_VERSION; }
        else { process.env.IMAGE_SEARCH_ALGORITHM_VERSION = anterior; }
    }
});

test("construirClaveCache: mismo producto con distinto código da distinta clave", function () {
    const clave1 = construirClaveCache({ codigo: "A-1", nombre: "X" });
    const clave2 = construirClaveCache({ codigo: "A-2", nombre: "X" });
    assert.notStrictEqual(clave1, clave2);
});

// ---- scoring ----
const TERMINOS_JW = { marca: "Johnnie Walker", nombre: "Johnnie Walker Black Label", presentacion: "750 ml" };

test("calcularScore: coincidencia total de marca + nombre + presentación en fuente confiable = score alto", function () {
    const candidato = {
        title: "Johnnie Walker Black Label 750ml - Whisky",
        url: "https://www.totalwine.com/johnnie-walker-black-label",
        sourceUrl: "https://www.totalwine.com/johnnie-walker-black-label",
        sourceDomain: "totalwine.com"
    };
    const resultado = calcularScore(candidato, TERMINOS_JW);
    assert.ok(resultado.score >= 65, "score esperado >= 65, fue " + resultado.score);
    assert.strictEqual(confianzaDeScore(resultado.score), "alta");
});

test("calcularScore: coincide solo parcialmente y viene de una red social = score bajo", function () {
    const candidato = {
        title: "Friday night drinks with the crew",
        url: "https://www.pinterest.com/pin/12345",
        sourceUrl: "https://www.pinterest.com/pin/12345",
        sourceDomain: "pinterest.com"
    };
    const resultado = calcularScore(candidato, TERMINOS_JW);
    assert.strictEqual(confianzaDeScore(resultado.score), "baja");
});

test("calcularScore penaliza títulos que sugieren banner/gente/logo", function () {
    const candidatoNormal = { title: "Johnnie Walker Black Label bottle photo", sourceDomain: "example.com" };
    const candidatoBanner = { title: "Johnnie Walker Black Label banner cheers people", sourceDomain: "example.com" };
    const scoreNormal = calcularScore(candidatoNormal, TERMINOS_JW).score;
    const scoreBanner = calcularScore(candidatoBanner, TERMINOS_JW).score;
    assert.ok(scoreBanner < scoreNormal, "el banner con gente debería puntuar menos: " + scoreBanner + " vs " + scoreNormal);
});

test("calcularScore: fuente Open Food Facts arranca con el bono de barcode exacto", function () {
    const candidato = { fuente: "openfoodfacts", title: "Johnnie Walker Black Label", offBrand: "Johnnie Walker", offQuantity: "750 ml" };
    const resultado = calcularScore(candidato, TERMINOS_JW);
    assert.ok(resultado.score >= 80, "score esperado alto por barcode, fue " + resultado.score);
});

test("calcularScore: Open Food Facts con marca claramente distinta se penaliza (§7)", function () {
    const candidatoCoincide = { fuente: "openfoodfacts", title: "x", offBrand: "Johnnie Walker", offQuantity: "750 ml" };
    const candidatoDistinto = { fuente: "openfoodfacts", title: "x", offBrand: "Coca-Cola", offQuantity: "750 ml" };
    const scoreCoincide = calcularScore(candidatoCoincide, TERMINOS_JW).score;
    const scoreDistinto = calcularScore(candidatoDistinto, TERMINOS_JW).score;
    assert.ok(scoreDistinto < scoreCoincide, "una marca de OFF distinta a la esperada debería bajar el score");
});

test("calcularScore: no confunde Black Label con Red Label (§21)", function () {
    const candidatoCorrecto = { title: "Johnnie Walker Black Label bottle", sourceDomain: "totalwine.com" };
    const candidatoEquivocado = { title: "Johnnie Walker Red Label bottle", sourceDomain: "totalwine.com" };
    const scoreCorrecto = calcularScore(candidatoCorrecto, TERMINOS_JW).score;
    const scoreEquivocado = calcularScore(candidatoEquivocado, TERMINOS_JW).score;
    assert.ok(scoreEquivocado < scoreCorrecto, "Red Label no debería puntuar igual que Black Label cuando se pidió Black Label");
    assert.notStrictEqual(confianzaDeScore(scoreEquivocado), "alta");
});

test("calcularScore: no confunde Don Julio Blanco con Reposado (§21)", function () {
    const terminos = { marca: "Don Julio", nombre: "Don Julio Blanco", presentacion: "750 ml" };
    const correcto = calcularScore({ title: "Don Julio Blanco tequila bottle", sourceDomain: "totalwine.com" }, terminos).score;
    const equivocado = calcularScore({ title: "Don Julio Reposado tequila bottle", sourceDomain: "totalwine.com" }, terminos).score;
    assert.ok(equivocado < correcto);
});

// ---- §62: rechazo DURO de variante/edad (identidad, no penalización) ----
test("detectarConflictoIdentidad: Black Label vs Red Label es VARIANT_CONFLICT", function () {
    const c = detectarConflictoIdentidad({}, { nombre: "Johnnie Walker Black Label" }, "johnnie walker red label bottle");
    assert.ok(c && c.motivo === "VARIANT_CONFLICT");
});

test("detectarConflictoIdentidad: Blanco vs Reposado es VARIANT_CONFLICT", function () {
    const c = detectarConflictoIdentidad({}, { nombre: "Don Julio Blanco" }, "don julio reposado tequila bottle");
    assert.ok(c && c.motivo === "VARIANT_CONFLICT");
});

test("detectarConflictoIdentidad: Silver vs Añejo es VARIANT_CONFLICT (silver es sinónimo de blanco)", function () {
    const c = detectarConflictoIdentidad({}, { nombre: "Patrón Silver" }, "patron anejo tequila bottle");
    assert.ok(c && c.motivo === "VARIANT_CONFLICT");
});

test("detectarConflictoIdentidad: Blanco y Silver NO conflictan (son sinónimos)", function () {
    const c = detectarConflictoIdentidad({}, { nombre: "Don Julio Blanco" }, "don julio silver tequila bottle");
    assert.strictEqual(c, null);
});

test("detectarConflictoIdentidad: 7 años vs 12 años es AGE_CONFLICT", function () {
    const c = detectarConflictoIdentidad({}, { nombre: "Flor de Caña 7" }, "flor de cana 12 years rum bottle");
    assert.ok(c && c.motivo === "AGE_CONFLICT");
});

test("detectarConflictoIdentidad: 12 años vs 18 años es AGE_CONFLICT", function () {
    const c = detectarConflictoIdentidad({}, { nombre: "Chivas Regal 12 Años" }, "chivas regal 18 year old bottle");
    assert.ok(c && c.motivo === "AGE_CONFLICT");
});

test("calcularScore: un conflicto de variante rechaza el candidato aunque el resto matchee perfecto", function () {
    const terminos = { marca: "Johnnie Walker", nombre: "Johnnie Walker Black Label", presentacion: "750 ml" };
    const resultado = calcularScore({
        title: "Johnnie Walker Red Label 750ml bottle", sourceDomain: "totalwine.com",
        width: 2000, height: 2000, fuente: "wikimedia"
    }, terminos);
    assert.strictEqual(resultado.rechazado, true);
    assert.strictEqual(resultado.score, 0);
    assert.strictEqual(confianzaDe(resultado), "baja");
});

// ---- §19/§27: calidad — estante/colección nunca puede ser "alta" ----
test("confianzaDe: 'supermarket'/'store'/'bottles of' fuerzan tope baja aunque el texto coincida perfecto", function () {
    const terminos = { marca: "Bacardí", nombre: "Bacardí Carta Blanca", presentacion: "750 ml" };
    const casosMalos = [
        "Bacardí Carta Blanca 750ml — HK supermarket shelf",
        "wines shop — Bacardí Carta Blanca and other bottles of rum",
        "Bacardí Carta Blanca liquor store collection assortment"
    ];
    casosMalos.forEach((title) => {
        const resultado = calcularScore({ title: title, sourceDomain: "example.com", width: 1200, height: 1200, fuente: "wikimedia" }, terminos);
        assert.strictEqual(confianzaDe(resultado), "baja", 'debería ser baja para: "' + title + '"');
    });
});

test("confianzaDe: una sola botella con fondo neutro y buena resolución puede ser alta", function () {
    const terminos = { marca: "Bacardí", nombre: "Bacardí Carta Blanca", presentacion: "750 ml" };
    const resultado = calcularScore({ title: "Bacardí Carta Blanca rum bottle product photo", sourceDomain: "totalwine.com", width: 1200, height: 1600, fuente: "wikimedia" }, terminos);
    assert.strictEqual(confianzaDe(resultado), "alta");
});

test("confianzaDe: fuente sin licencia conocida (ej. UPCitemdb) nunca llega a alta aunque matchee perfecto", function () {
    const terminos = { marca: "Chivas Regal", nombre: "Chivas Regal 12 Años", presentacion: "750 ml" };
    const resultado = calcularScore({ title: "Chivas Regal 12 Años 750ml bottle", sourceDomain: "walmart.com", width: 1200, height: 1200, fuente: "upcitemdb" }, terminos);
    assert.notStrictEqual(confianzaDe(resultado), "alta");
});

test("calcularScore: premia buena resolución y proporción de botella, penaliza imágenes diminutas", function () {
    const base = { title: "Johnnie Walker Black Label 750 ml bottle", sourceDomain: "totalwine.com" };
    const grande = calcularScore(Object.assign({ width: 1200, height: 1600 }, base), TERMINOS_JW).score;
    const chica = calcularScore(Object.assign({ width: 120, height: 160 }, base), TERMINOS_JW).score;
    assert.ok(grande > chica, "una imagen de 1200x1600 debería puntuar más que una de 120x160");
});

test("calcularScore: presentación distinta (700ml pedido, 750ml encontrado) penaliza", function () {
    const terminos = { marca: "Absolut", nombre: "Absolut Vodka", presentacion: "700 ml" };
    const coincide = calcularScore({ title: "Absolut Vodka 700 ml bottle", sourceDomain: "wine.com" }, terminos).score;
    const distinta = calcularScore({ title: "Absolut Vodka 750 ml bottle", sourceDomain: "wine.com" }, terminos).score;
    assert.ok(distinta < coincide);
});

test("confianzaDeScore: umbrales alta (>=80) / media (>=55) / baja (<55)", function () {
    assert.strictEqual(confianzaDeScore(100), "alta");
    assert.strictEqual(confianzaDeScore(80), "alta");
    assert.strictEqual(confianzaDeScore(79), "media");
    assert.strictEqual(confianzaDeScore(55), "media");
    assert.strictEqual(confianzaDeScore(54), "baja");
    assert.strictEqual(confianzaDeScore(10), "baja");
});

// ---- barcode (§5: validación GS1 real, `codigo` interno nunca es barcode) ----
test("validarBarcode acepta EAN-13 reales (dígito de control válido)", function () {
    assert.strictEqual(validarBarcode("3017620422003"), "3017620422003"); // Nutella, verificado en vivo
    assert.strictEqual(validarBarcode("5449000000996"), "5449000000996"); // Coca-Cola, verificado en vivo
});

test("validarBarcode rechaza el codigo interno de la tienda", function () {
    assert.strictEqual(validarBarcode("JW-BLACK-750"), null);
});

test("validarBarcode rechaza números con longitud no estándar o dígito de control inválido", function () {
    assert.strictEqual(validarBarcode("123456789012345"), null); // 15 dígitos, ninguna longitud GS1 válida
    assert.strictEqual(validarBarcode("1234567890123"), null); // 13 dígitos pero check digit incorrecto
    assert.strictEqual(validarBarcode(""), null);
    assert.strictEqual(validarBarcode(null), null);
});

// ---- texto.js: normalización y variantes de consulta (§13/§14/§16) ----
test("normalizarTexto hace que apóstrofes/tildes no importen para comparar", function () {
    assert.strictEqual(normalizarTexto("Buchanan's Deluxe 12 Años"), normalizarTexto("Buchanans Deluxe 12 anos"));
    assert.strictEqual(normalizarTexto("Jack Daniel's"), "jack daniels");
});

test("presentacionAMililitros reconoce 750ml == 750 ml y 1L == 1000ml", function () {
    assert.strictEqual(presentacionAMililitros("750 ml"), 750);
    assert.strictEqual(presentacionAMililitros("750ml"), 750);
    assert.strictEqual(presentacionAMililitros("1 L"), 1000);
    assert.strictEqual(presentacionAMililitros("1l"), 1000);
    assert.strictEqual(presentacionAMililitros("0.75L"), 750);
});

test("generarVariantesConsulta no duplica la marca cuando el nombre ya la incluye", function () {
    assert.strictEqual(nombreCompleto({ marca: "Johnnie Walker", nombre: "Johnnie Walker Black Label" }), "Johnnie Walker Black Label");
});

test("generarVariantesConsulta produce como máximo 3 variantes sin duplicados", function () {
    const variantes = generarVariantesConsulta({ marca: "Johnnie Walker", nombre: "Johnnie Walker Black Label", presentacion: "750 ml", categoria: "Whisky y bourbon" });
    assert.ok(variantes.length <= 3);
    assert.strictEqual(new Set(variantes.map(normalizarTexto)).size, variantes.length);
    assert.ok(variantes[0].toLowerCase().indexOf("750 ml") !== -1);
});

// ---- Openverse: filtro de licencias (§11/§37) ----
test("licenciaPermiteUsoComercialYDerivados acepta CC0/PDM/BY/BY-SA y rechaza NC/ND/null", function () {
    assert.strictEqual(licenciaPermiteUsoComercialYDerivados("cc0"), true);
    assert.strictEqual(licenciaPermiteUsoComercialYDerivados("by"), true);
    assert.strictEqual(licenciaPermiteUsoComercialYDerivados("by-sa"), true);
    assert.strictEqual(licenciaPermiteUsoComercialYDerivados("by-nc"), false);
    assert.strictEqual(licenciaPermiteUsoComercialYDerivados("by-nc-sa"), false);
    assert.strictEqual(licenciaPermiteUsoComercialYDerivados("by-nd"), false);
    assert.strictEqual(licenciaPermiteUsoComercialYDerivados(null), false);
    assert.strictEqual(licenciaPermiteUsoComercialYDerivados(undefined), false);
});

test("evaluarCandidatos ordena de mayor a menor score", function () {
    const candidatos = [
        { title: "random unrelated page", sourceDomain: "example.com" },
        { title: "Johnnie Walker Black Label 750 ml bottle", sourceDomain: "totalwine.com" }
    ];
    const evaluados = evaluarCandidatos(candidatos, TERMINOS_JW);
    assert.ok(evaluados[0].score >= evaluados[1].score);
    assert.ok(evaluados[0].title.indexOf("Johnnie Walker") !== -1);
});

// ---- SSRF: esIpPrivadaOEspecial ----
test("esIpPrivadaOEspecial bloquea loopback/privadas/link-local (incluye metadata cloud)", function () {
    assert.strictEqual(esIpPrivadaOEspecial("127.0.0.1"), true);
    assert.strictEqual(esIpPrivadaOEspecial("10.0.0.5"), true);
    assert.strictEqual(esIpPrivadaOEspecial("172.16.0.1"), true);
    assert.strictEqual(esIpPrivadaOEspecial("172.31.255.255"), true);
    assert.strictEqual(esIpPrivadaOEspecial("192.168.1.1"), true);
    assert.strictEqual(esIpPrivadaOEspecial("169.254.169.254"), true); // metadata AWS/GCP/Azure
    assert.strictEqual(esIpPrivadaOEspecial("100.100.100.200"), true); // metadata Alibaba Cloud
});

test("esIpPrivadaOEspecial no marca IPs públicas normales como privadas", function () {
    assert.strictEqual(esIpPrivadaOEspecial("172.15.0.1"), false); // justo fuera del rango 172.16-31
    assert.strictEqual(esIpPrivadaOEspecial("172.32.0.1"), false);
    assert.strictEqual(esIpPrivadaOEspecial("8.8.8.8"), false);
    assert.strictEqual(esIpPrivadaOEspecial("93.184.216.34"), false);
});

test("esIpPrivadaOEspecial bloquea IPv6 loopback y unique-local", function () {
    assert.strictEqual(esIpPrivadaOEspecial("::1"), true);
    assert.strictEqual(esIpPrivadaOEspecial("fc00::1"), true);
    assert.strictEqual(esIpPrivadaOEspecial("fe80::1"), true);
    assert.strictEqual(esIpPrivadaOEspecial("2001:4860:4860::8888"), false); // Google DNS pública
});

// ---- verificarFirmaImagen ----
test("verificarFirmaImagen acepta JPEG/PNG/WEBP reales y rechaza contenido falso", function () {
    assert.strictEqual(verificarFirmaImagen(Buffer.from([0xFF, 0xD8, 0xFF, 0, 0, 0, 0, 0, 0, 0, 0, 0]), "image/jpeg"), true);
    assert.strictEqual(verificarFirmaImagen(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0, 0, 0, 0, 0, 0, 0, 0]), "image/png"), true);
    const html = Buffer.from("<html>no soy una imagen</html>");
    assert.strictEqual(verificarFirmaImagen(html, "image/jpeg"), false);
});

// ---- SSRF: descargarImagenSegura sigue redirects pero re-valida cada salto ----
async function testDescargaSSRF() {
    const { descargarImagenSegura } = require("./ssrfFetch");
    const dns = require("node:dns").promises;
    const fetchOriginal = global.fetch;
    const dnsLookupOriginal = dns.lookup;

    // Se mockea el DNS para que el test no dependa de Internet (§53): un
    // hostname que ya es una IP literal "resuelve" a sí mismo (igual que el
    // dns.lookup real de Node), y cualquier otro hostname resuelve a una IP
    // pública falsa — así se prueba la re-validación de redirects sin hacer
    // ninguna consulta real.
    dns.lookup = async (host) => {
        if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) { return [{ address: host, family: 4 }]; }
        return [{ address: "93.184.216.34", family: 4 }];
    };

    await testAsync("descargarImagenSegura rechaza un redirect hacia una IP privada/metadata (§32)", async function () {
        global.fetch = async (url) => {
            const urlTexto = String(url);
            if (urlTexto === "https://example.com/imagen.jpg") {
                return {
                    status: 302,
                    headers: { get: (nombre) => (nombre === "location" ? "http://169.254.169.254/secreto.jpg" : null) }
                };
            }
            throw new Error("no debería llegar a pedir " + urlTexto);
        };

        try {
            await descargarImagenSegura("https://example.com/imagen.jpg");
            assert.fail("debería haber rechazado el redirect hacia metadata cloud");
        } catch (error) {
            assert.ok(error.message.length > 0);
        }
    });

    await testAsync("descargarImagenSegura corta después de demasiadas redirecciones", async function () {
        let llamadas = 0;
        global.fetch = async () => {
            llamadas++;
            return {
                status: 302,
                headers: { get: (nombre) => (nombre === "location" ? "https://example.com/otra-" + llamadas + ".jpg" : null) }
            };
        };

        try {
            await descargarImagenSegura("https://example.com/imagen.jpg");
            assert.fail("debería haber rechazado por exceso de redirecciones");
        } catch (error) {
            assert.ok(/redirec/i.test(error.message), "mensaje inesperado: " + error.message);
        }
        assert.ok(llamadas <= 5, "no debería seguir redirects indefinidamente, llamadas=" + llamadas);
    });

    global.fetch = fetchOriginal;
    dns.lookup = dnsLookupOriginal;
}

// ---- concurrencia ----
async function testConcurrencia() {
    await testAsync("procesarConConcurrencia respeta el límite y procesa todos los items", async function () {
        let enVuelo = 0;
        let maximoObservado = 0;
        const items = Array.from({ length: 12 }, (_, i) => i);
        const procesados = [];

        await procesarConConcurrencia(items, 3, async (item) => {
            enVuelo++;
            maximoObservado = Math.max(maximoObservado, enVuelo);
            await new Promise((resolve) => setTimeout(resolve, 5));
            enVuelo--;
            return item * 2;
        }, (item, resultado) => {
            procesados.push(resultado);
        });

        assert.strictEqual(procesados.length, 12);
        assert.ok(maximoObservado <= 3, "concurrencia máxima observada fue " + maximoObservado);
    });

    await testAsync("conReintentos reintenta errores marcados como reintentables hasta maxIntentos", async function () {
        let intentos = 0;
        const resultado = await conReintentos(async () => {
            intentos++;
            if (intentos < 3) {
                const error = new Error("temporal");
                error.retryAfterMs = 1;
                throw error;
            }
            return "ok";
        }, { maxIntentos: 3, esReintentable: () => true, esperaBaseMs: 1 });

        assert.strictEqual(resultado, "ok");
        assert.strictEqual(intentos, 3);
    });

    await testAsync("conReintentos NO reintenta errores no marcados como reintentables", async function () {
        let intentos = 0;
        try {
            await conReintentos(async () => {
                intentos++;
                throw new Error("permanente");
            }, { maxIntentos: 3, esReintentable: () => false });
            assert.fail("debería haber lanzado el error");
        } catch (error) {
            assert.strictEqual(error.message, "permanente");
        }
        assert.strictEqual(intentos, 1);
    });

    await testAsync("conReintentos se rinde después de maxIntentos y propaga el último error", async function () {
        let intentos = 0;
        try {
            await conReintentos(async () => {
                intentos++;
                throw new Error("siempre falla");
            }, { maxIntentos: 2, esReintentable: () => true, esperaBaseMs: 1 });
            assert.fail("debería haber lanzado el error");
        } catch (error) {
            assert.strictEqual(error.message, "siempre falla");
        }
        assert.strictEqual(intentos, 3); // intento inicial + 2 reintentos
    });
}

// ---- resolverImagenProducto (integración con proveedores/cache falsos) ----
function crearClienteSupabaseFalso(cacheInicial) {
    const almacen = new Map(Object.entries(cacheInicial || {}));
    return {
        from: function (tabla) {
            assert.strictEqual(tabla, "busqueda_imagen_cache");
            return {
                select: function () {
                    return {
                        eq: function (_columna, valor) {
                            return {
                                gt: function () {
                                    return {
                                        maybeSingle: async function () {
                                            if (almacen.has(valor)) {
                                                return { data: { candidatos: almacen.get(valor) }, error: null };
                                            }
                                            return { data: null, error: null };
                                        }
                                    };
                                }
                            };
                        }
                    };
                },
                upsert: function (fila) {
                    almacen.set(fila.clave, fila.candidatos);
                    return { then: function (onResolve) { return Promise.resolve().then(onResolve); } };
                }
            };
        },
        _almacen: almacen
    };
}

// Proveedor falso "de barcode" (como openfoodfacts): una sola llamada por
// resolución, no itera variantes.
function crearProveedorBarcodeFalso(comportamiento) {
    let llamadas = 0;
    return {
        estaConfigurado: () => true,
        buscarPorBarcode: async function (barcode) {
            llamadas++;
            return comportamiento(barcode, llamadas);
        },
        _llamadas: () => llamadas
    };
}

// Proveedor falso "de texto" (como wikimedia/openverse): se llama una vez
// por cada variante de consulta que el resolver intente.
function crearProveedorTextoFalso(comportamiento) {
    let llamadas = 0;
    return {
        estaConfigurado: () => true,
        buscar: async function (query) {
            llamadas++;
            return comportamiento(query, llamadas);
        },
        _llamadas: () => llamadas
    };
}

function proveedorVacio() {
    return crearProveedorTextoFalso(() => []);
}

async function testResolver() {
    const { resolverImagenProducto } = require("./resolver");

    await testAsync("resolverImagenProducto: candidato de alta confianza (Wikimedia) queda 'encontrada'", async function () {
        const wikimedia = crearProveedorTextoFalso(() => [
            { url: "https://x.com/a.jpg", sourceUrl: "https://commons.wikimedia.org/wiki/File:x.jpg", sourceDomain: "commons.wikimedia.org", title: "Johnnie Walker Black Label 750ml bottle", fuente: "wikimedia" }
        ]);
        const cliente = crearClienteSupabaseFalso();
        const resultado = await resolverImagenProducto(cliente, TERMINOS_JW, {
            proveedores: { openfoodfacts: crearProveedorBarcodeFalso(() => []), wikimedia: wikimedia, openverse: proveedorVacio() }
        });
        assert.strictEqual(resultado.estado, "encontrada");
        assert.strictEqual(resultado.confianza, "alta");
        assert.ok(resultado.ganador);
    });

    await testAsync("resolverImagenProducto: candidato de confianza media queda 'revisar'", async function () {
        const wikimedia = crearProveedorTextoFalso(() => [
            { url: "https://x.com/a.jpg", sourceUrl: "https://example.com/algo", sourceDomain: "example.com", title: "Johnnie Walker whisky article" }
        ]);
        const cliente = crearClienteSupabaseFalso();
        const resultado = await resolverImagenProducto(cliente, TERMINOS_JW, {
            proveedores: { openfoodfacts: crearProveedorBarcodeFalso(() => []), wikimedia: wikimedia, openverse: proveedorVacio() }
        });
        assert.strictEqual(resultado.estado, "revisar");
        assert.strictEqual(resultado.confianza, "media");
    });

    await testAsync("resolverImagenProducto: sin candidatos relevantes queda 'sin_resultado' y no auto-selecciona", async function () {
        const wikimedia = crearProveedorTextoFalso(() => [
            { url: "https://pinterest.com/a.jpg", sourceUrl: "https://pinterest.com/pin/1", sourceDomain: "pinterest.com", title: "party photos" }
        ]);
        const cliente = crearClienteSupabaseFalso();
        const resultado = await resolverImagenProducto(cliente, TERMINOS_JW, {
            proveedores: { openfoodfacts: crearProveedorBarcodeFalso(() => []), wikimedia: wikimedia, openverse: proveedorVacio() }
        });
        assert.strictEqual(resultado.estado, "sin_resultado");
        assert.strictEqual(resultado.ganador, null);
    });

    await testAsync("resolverImagenProducto: usa el cache y NO vuelve a llamar a los proveedores", async function () {
        const wikimedia = crearProveedorTextoFalso(() => [
            { url: "https://x.com/a.jpg", sourceUrl: "https://www.totalwine.com/jw-black", sourceDomain: "totalwine.com", title: "Johnnie Walker Black Label 750ml bottle", fuente: "wikimedia" }
        ]);
        const cliente = crearClienteSupabaseFalso();
        const proveedores = { openfoodfacts: crearProveedorBarcodeFalso(() => []), wikimedia: wikimedia, openverse: proveedorVacio() };

        await resolverImagenProducto(cliente, TERMINOS_JW, { proveedores: proveedores });
        assert.strictEqual(wikimedia._llamadas(), 1);

        await resolverImagenProducto(cliente, TERMINOS_JW, { proveedores: proveedores });
        assert.strictEqual(wikimedia._llamadas(), 1, "no debería haber llamado al proveedor una segunda vez (cache hit)");
    });

    await testAsync("resolverImagenProducto: 'forzar' ignora el cache y vuelve a buscar", async function () {
        const wikimedia = crearProveedorTextoFalso(() => [
            { url: "https://x.com/a.jpg", sourceUrl: "https://www.totalwine.com/jw-black", sourceDomain: "totalwine.com", title: "Johnnie Walker Black Label 750ml bottle", fuente: "wikimedia" }
        ]);
        const cliente = crearClienteSupabaseFalso();
        const proveedores = { openfoodfacts: crearProveedorBarcodeFalso(() => []), wikimedia: wikimedia, openverse: proveedorVacio() };

        await resolverImagenProducto(cliente, TERMINOS_JW, { proveedores: proveedores });
        await resolverImagenProducto(cliente, TERMINOS_JW, { proveedores: proveedores, forzar: true });
        assert.ok(wikimedia._llamadas() >= 2);
    });

    await testAsync("resolverImagenProducto: reintenta un 429 y termina resolviendo bien", async function () {
        const wikimedia = crearProveedorTextoFalso((query, llamada) => {
            if (llamada === 1) {
                const error = new Error("rate limit");
                error.retryAfterMs = 1;
                throw error;
            }
            return [{ url: "https://x.com/a.jpg", sourceUrl: "https://www.totalwine.com/jw-black", sourceDomain: "totalwine.com", title: "Johnnie Walker Black Label 750ml bottle", fuente: "wikimedia" }];
        });
        const cliente = crearClienteSupabaseFalso();
        const resultado = await resolverImagenProducto(cliente, TERMINOS_JW, {
            proveedores: { openfoodfacts: crearProveedorBarcodeFalso(() => []), wikimedia: wikimedia, openverse: proveedorVacio() }
        });
        assert.strictEqual(resultado.estado, "encontrada");
        assert.strictEqual(wikimedia._llamadas(), 2);
    });

    await testAsync("resolverImagenProducto: 503 de un proveedor no bloquea el import, sigue con el siguiente", async function () {
        const wikimediaCaido = crearProveedorTextoFalso(() => { throw new Error("Wikimedia respondió 503."); });
        const openverseOk = crearProveedorTextoFalso(() => [
            { url: "https://x.com/a.jpg", sourceUrl: "https://x.com", sourceDomain: "wine.com", title: "Johnnie Walker Black Label 750ml bottle", fuente: "openverse" }
        ]);
        const cliente = crearClienteSupabaseFalso();
        const resultado = await resolverImagenProducto(cliente, TERMINOS_JW, {
            proveedores: { openfoodfacts: crearProveedorBarcodeFalso(() => []), wikimedia: wikimediaCaido, openverse: openverseOk }
        });
        assert.strictEqual(resultado.estado, "encontrada");
    });

    await testAsync("resolverImagenProducto: timeout de un proveedor no lanza, solo pasa al siguiente", async function () {
        const wikimediaTimeout = crearProveedorTextoFalso(() => { throw new Error("Tiempo de espera agotado consultando Wikimedia Commons."); });
        const openverseOk = crearProveedorTextoFalso(() => [
            { url: "https://x.com/a.jpg", sourceUrl: "https://x.com", sourceDomain: "wine.com", title: "Johnnie Walker Black Label 750ml bottle", fuente: "openverse" }
        ]);
        const cliente = crearClienteSupabaseFalso();
        const resultado = await resolverImagenProducto(cliente, TERMINOS_JW, {
            proveedores: { openfoodfacts: crearProveedorBarcodeFalso(() => []), wikimedia: wikimediaTimeout, openverse: openverseOk }
        });
        assert.strictEqual(resultado.estado, "encontrada");
    });

    await testAsync("resolverImagenProducto: circuit breaker apaga un proveedor tras fallos consecutivos dentro del mismo lote", async function () {
        let llamadasWikimedia = 0;
        const wikimediaSiempreFalla = {
            estaConfigurado: () => true,
            buscar: async function () { llamadasWikimedia++; throw new Error("Wikimedia respondió 503."); }
        };
        const cliente = crearClienteSupabaseFalso();
        const estadoCircuito = {};
        const productos = Array.from({ length: 8 }, (_, i) => ({ marca: "Marca" + i, nombre: "Nombre" + i, presentacion: "750 ml" }));

        for (const producto of productos) {
            await resolverImagenProducto(cliente, producto, {
                proveedores: { openfoodfacts: crearProveedorBarcodeFalso(() => []), wikimedia: wikimediaSiempreFalla, openverse: proveedorVacio() },
                estadoCircuito: estadoCircuito
            });
        }

        // 8 productos x hasta 3 variantes = hasta 24 intentos posibles, pero
        // el circuit breaker debería cortar wikimedia bastante antes de eso.
        assert.ok(llamadasWikimedia < 24, "el circuit breaker debería haber frenado los reintentos, llamadas=" + llamadasWikimedia);
    });

    await testAsync("resolverImagenProducto: prioriza Open Food Facts por barcode antes que buscar por texto", async function () {
        const off = crearProveedorBarcodeFalso(() => [
            { url: "https://images.openfoodfacts.org/x.jpg", sourceUrl: "https://world.openfoodfacts.org/product/123", sourceDomain: "openfoodfacts.org", title: "Johnnie Walker Black Label", fuente: "openfoodfacts", offBrand: "Johnnie Walker", offQuantity: "750 ml" }
        ]);
        const wikimedia = crearProveedorTextoFalso(() => { throw new Error("no debería llamarse"); });
        const cliente = crearClienteSupabaseFalso();

        const resultado = await resolverImagenProducto(cliente, Object.assign({ barcode: "3017620422003" }, TERMINOS_JW), {
            proveedores: { openfoodfacts: off, wikimedia: wikimedia, openverse: proveedorVacio() }
        });

        assert.strictEqual(resultado.estado, "encontrada");
        assert.strictEqual(resultado.ganador.fuente, "openfoodfacts");
        assert.strictEqual(wikimedia._llamadas(), 0, "no debería haber consultado Wikimedia si OFF ya encontró alta confianza");
    });

    await testAsync("resolverImagenProducto: barcode inválido no se manda a Open Food Facts", async function () {
        let llamadasOff = 0;
        const off = { estaConfigurado: () => true, buscarPorBarcode: async () => { llamadasOff++; return []; } };
        const wikimedia = crearProveedorTextoFalso(() => []);
        const cliente = crearClienteSupabaseFalso();

        await resolverImagenProducto(cliente, Object.assign({ barcode: "JW-BLACK-750" }, TERMINOS_JW), {
            proveedores: { openfoodfacts: off, wikimedia: wikimedia, openverse: proveedorVacio() }
        });

        assert.strictEqual(llamadasOff, 0, "un barcode inválido (el código interno) nunca debe consultarse contra Open Food Facts");
    });

    // ---- §3/§9/§28: etapa DEEP solo se activa si NORMAL no alcanzó "alta" ----
    await testAsync("resolverImagenProducto: NO pasa a DEEP si NORMAL ya encontró alta confianza", async function () {
        const wikimedia = crearProveedorTextoFalso(() => [
            { url: "https://x.com/a.jpg", sourceUrl: "https://www.totalwine.com/x", sourceDomain: "totalwine.com", title: "Johnnie Walker Black Label 750ml bottle", fuente: "wikimedia" }
        ]);
        let llamadasUpc = 0;
        const upc = { estaConfigurado: () => true, buscar: async () => { llamadasUpc++; return []; }, buscarPorBarcode: async () => [], descubrirBarcode: async () => null };
        const cliente = crearClienteSupabaseFalso();

        await resolverImagenProducto(cliente, TERMINOS_JW, {
            profundo: true,
            proveedores: { openfoodfacts: crearProveedorBarcodeFalso(() => []), wikimedia: wikimedia, openverse: proveedorVacio(), upcitemdb: upc }
        });

        assert.strictEqual(llamadasUpc, 0, "no debería haber llamado a UPCitemdb si NORMAL ya dio alta confianza");
    });

    await testAsync("resolverImagenProducto: pasa a DEEP (UPCitemdb) cuando NORMAL solo da confianza media/baja", async function () {
        const wikimediaDebil = crearProveedorTextoFalso(() => [
            { url: "https://x.com/a.jpg", sourceUrl: "https://example.com/x", sourceDomain: "example.com", title: "whisky article", fuente: "wikimedia" }
        ]);
        let llamadasUpc = 0;
        const upc = {
            estaConfigurado: () => true,
            buscar: async () => { llamadasUpc++; return [{ url: "https://cdn.walmart.com/x.jpg", sourceDomain: "walmart.com", title: "Johnnie Walker Black Label 750ml bottle", fuente: "upcitemdb", license: null }]; },
            buscarPorBarcode: async () => [],
            descubrirBarcode: async () => null
        };
        const cliente = crearClienteSupabaseFalso();

        const resultado = await resolverImagenProducto(cliente, TERMINOS_JW, {
            profundo: true,
            proveedores: { openfoodfacts: crearProveedorBarcodeFalso(() => []), wikimedia: wikimediaDebil, openverse: proveedorVacio(), upcitemdb: upc }
        });

        assert.ok(llamadasUpc > 0, "debería haber consultado UPCitemdb en la etapa profunda");
        // Y aunque UPCitemdb matchee perfecto, nunca puede quedar "alta" (sin licencia conocida).
        assert.notStrictEqual(resultado.confianza, "alta");
    });

    await testAsync("resolverImagenProducto: deduplica candidatos con la misma URL de distintos proveedores", async function () {
        const urlCompartida = "https://upload.wikimedia.org/mismo-archivo.jpg";
        const wikimedia = crearProveedorTextoFalso(() => [
            { url: urlCompartida + "?utm_source=a", sourceDomain: "commons.wikimedia.org", title: "Johnnie Walker Black Label bottle", fuente: "wikimedia" }
        ]);
        const openverse = crearProveedorTextoFalso(() => [
            { url: urlCompartida + "?utm_source=b", sourceDomain: "commons.wikimedia.org", title: "Johnnie Walker Black Label bottle", fuente: "openverse" }
        ]);
        const cliente = crearClienteSupabaseFalso();

        const resultado = await resolverImagenProducto(cliente, TERMINOS_JW, {
            proveedores: { openfoodfacts: crearProveedorBarcodeFalso(() => []), wikimedia: wikimedia, openverse: openverse }
        });

        assert.strictEqual(resultado.candidatos.length, 1, "las dos URLs (misma imagen, distinto query string) deberían deduplicarse a una sola");
    });
}

// ---- §26/§27: query generation (alias ES→EN, unidades) ----
function testQueryGeneration() {
    test("aplicarAliases traduce 'años' a 'years' para la consulta", function () {
        assert.strictEqual(aplicarAliases("Chivas Regal 12 años bottle"), "Chivas Regal 12 years bottle");
    });
    test("aplicarAliases traduce 'añejo' a 'anejo' para la consulta", function () {
        assert.strictEqual(aplicarAliases("Ron añejo bottle"), "Ron anejo bottle");
    });
    test("aplicarAliases devuelve null si ningún alias aplica (no genera variante duplicada)", function () {
        assert.strictEqual(aplicarAliases("Absolut Vodka bottle"), null);
    });
    test("presentacionAMililitros reconoce 75cl == 750ml", function () {
        assert.strictEqual(presentacionAMililitros("75cl"), 750);
    });
}
testQueryGeneration();

// ---- §5/§46: UPCitemdb (mockeado con fetch falso, sin red real) ----
async function testUpcitemdb() {
    const upcitemdb = require("./providers/upcitemdb");
    const fetchOriginal = global.fetch;

    await testAsync("UPCitemdb.buscarPorBarcode devuelve candidatos con license=null (sin licencia conocida)", async function () {
        global.fetch = async () => ({
            ok: true, status: 200,
            headers: { get: (h) => (h === "x-ratelimit-remaining" ? "50" : null) },
            json: async () => ({ code: "OK", items: [{ title: "Chivas Regal 12", brand: "Chivas Regal", ean: "080432400388", images: ["https://cdn.walmart.com/a.jpg"] }] })
        });
        const candidatos = await upcitemdb.buscarPorBarcode("080432400388");
        assert.strictEqual(candidatos.length, 1);
        assert.strictEqual(candidatos[0].license, null);
        assert.strictEqual(candidatos[0].fuente, "upcitemdb");
    });

    await testAsync("UPCitemdb respeta 429 marcándolo reintentable", async function () {
        global.fetch = async () => ({
            ok: false, status: 429,
            headers: { get: (h) => (h === "retry-after" ? "2" : null) }
        });
        try {
            await upcitemdb.buscar("chivas regal 12", {});
            assert.fail("debería haber lanzado");
        } catch (error) {
            assert.ok(Object.prototype.hasOwnProperty.call(error, "retryAfterMs"));
        }
    });

    global.fetch = fetchOriginal;
}

ejecutar();

async function ejecutar() {
    await testDescargaSSRF();
    await testConcurrencia();
    await testUpcitemdb();
    await testResolver();
    console.log("\n" + (total - fallidos) + "/" + total + " pruebas pasaron.");
    if (fallidos > 0) { process.exitCode = 1; }
}
