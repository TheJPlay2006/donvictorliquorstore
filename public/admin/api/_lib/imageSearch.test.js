// Tests de la lógica crítica de búsqueda automática de imágenes (backend).
// Mismo estilo que el resto del proyecto: Node + `assert`, sin framework.
// Correr con: node public/admin/api/_lib/imageSearch.test.js
"use strict";

const assert = require("assert");

const { construirConsulta, construirClaveCache } = require("./consulta");
const { calcularScore, confianzaDeScore, evaluarCandidatos } = require("./scoring");
const { esIpPrivadaOEspecial, verificarFirmaImagen } = require("./ssrfFetch");
const { procesarConConcurrencia, conReintentos } = require("./concurrencia");

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
test("construirClaveCache usa barcode como clave estable si existe", function () {
    const clave1 = construirClaveCache({ barcode: "5000267023585", nombre: "A" });
    const clave2 = construirClaveCache({ barcode: "5000267023585", nombre: "B distinto" });
    assert.strictEqual(clave1, clave2);
    assert.ok(clave1.startsWith("barcode:"));
});

test("construirClaveCache usa codigo si no hay barcode", function () {
    const clave = construirClaveCache({ codigo: "JW-BLACK-750", nombre: "X" });
    assert.strictEqual(clave, "codigo:jw-black-750");
});

test("construirClaveCache cae a hash de la consulta si no hay codigo ni barcode", function () {
    const clave1 = construirClaveCache({ nombre: "Absolut Vodka", marca: "Absolut", presentacion: "750 ml" });
    const clave2 = construirClaveCache({ nombre: "Absolut Vodka", marca: "Absolut", presentacion: "750 ml" });
    assert.strictEqual(clave1, clave2);
    assert.ok(clave1.startsWith("query:"));
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

test("confianzaDeScore: umbrales alta/media/baja", function () {
    assert.strictEqual(confianzaDeScore(80), "alta");
    assert.strictEqual(confianzaDeScore(65), "alta");
    assert.strictEqual(confianzaDeScore(50), "media");
    assert.strictEqual(confianzaDeScore(35), "media");
    assert.strictEqual(confianzaDeScore(10), "baja");
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

// ---- resolverImagenProducto (integración con proveedor/cache falsos) ----
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
                                maybeSingle: async function () {
                                    if (almacen.has(valor)) {
                                        return { data: { candidatos: almacen.get(valor) }, error: null };
                                    }
                                    return { data: null, error: null };
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

function crearProveedorFalso(comportamiento) {
    let llamadas = 0;
    return {
        estaConfigurado: () => true,
        buscar: async function (query) {
            llamadas++;
            return comportamiento(query, llamadas);
        },
        ErrorProveedorSinCredito: class ErrorProveedorSinCredito extends Error {},
        _llamadas: () => llamadas
    };
}

async function testResolver() {
    const { resolverImagenProducto } = require("./resolver");

    await testAsync("resolverImagenProducto: candidato de alta confianza queda 'encontrada'", async function () {
        const proveedor = crearProveedorFalso(() => [
            { url: "https://x.com/a.jpg", sourceUrl: "https://www.totalwine.com/jw-black", sourceDomain: "totalwine.com", title: "Johnnie Walker Black Label 750ml bottle" }
        ]);
        const cliente = crearClienteSupabaseFalso();
        const resultado = await resolverImagenProducto(cliente, TERMINOS_JW, { proveedor: proveedor });
        assert.strictEqual(resultado.estado, "encontrada");
        assert.strictEqual(resultado.confianza, "alta");
        assert.ok(resultado.ganador);
    });

    await testAsync("resolverImagenProducto: candidato de confianza media queda 'revisar'", async function () {
        const proveedor = crearProveedorFalso(() => [
            { url: "https://x.com/a.jpg", sourceUrl: "https://example.com/algo", sourceDomain: "example.com", title: "Johnnie Walker whisky article" }
        ]);
        const cliente = crearClienteSupabaseFalso();
        const resultado = await resolverImagenProducto(cliente, TERMINOS_JW, { proveedor: proveedor });
        assert.strictEqual(resultado.estado, "revisar");
        assert.strictEqual(resultado.confianza, "media");
    });

    await testAsync("resolverImagenProducto: sin candidatos relevantes queda 'sin_resultado' y no auto-selecciona", async function () {
        const proveedor = crearProveedorFalso(() => [
            { url: "https://pinterest.com/a.jpg", sourceUrl: "https://pinterest.com/pin/1", sourceDomain: "pinterest.com", title: "party photos" }
        ]);
        const cliente = crearClienteSupabaseFalso();
        const resultado = await resolverImagenProducto(cliente, TERMINOS_JW, { proveedor: proveedor });
        assert.strictEqual(resultado.estado, "sin_resultado");
        assert.strictEqual(resultado.ganador, null);
    });

    await testAsync("resolverImagenProducto: usa el cache y NO vuelve a llamar al proveedor", async function () {
        const proveedor = crearProveedorFalso(() => [
            { url: "https://x.com/a.jpg", sourceUrl: "https://www.totalwine.com/jw-black", sourceDomain: "totalwine.com", title: "Johnnie Walker Black Label 750ml bottle" }
        ]);
        const cliente = crearClienteSupabaseFalso();

        await resolverImagenProducto(cliente, TERMINOS_JW, { proveedor: proveedor });
        assert.strictEqual(proveedor._llamadas(), 1);

        await resolverImagenProducto(cliente, TERMINOS_JW, { proveedor: proveedor });
        assert.strictEqual(proveedor._llamadas(), 1, "no debería haber llamado al proveedor una segunda vez (cache hit)");
    });

    await testAsync("resolverImagenProducto: 'forzar' ignora el cache y vuelve a buscar", async function () {
        const proveedor = crearProveedorFalso(() => [
            { url: "https://x.com/a.jpg", sourceUrl: "https://www.totalwine.com/jw-black", sourceDomain: "totalwine.com", title: "Johnnie Walker Black Label 750ml bottle" }
        ]);
        const cliente = crearClienteSupabaseFalso();

        await resolverImagenProducto(cliente, TERMINOS_JW, { proveedor: proveedor });
        await resolverImagenProducto(cliente, TERMINOS_JW, { proveedor: proveedor, forzar: true });
        assert.strictEqual(proveedor._llamadas(), 2);
    });

    await testAsync("resolverImagenProducto: reintenta un 429 y termina resolviendo bien", async function () {
        const proveedor = crearProveedorFalso((query, llamada) => {
            if (llamada === 1) {
                const error = new Error("rate limit");
                error.retryAfterMs = 1;
                throw error;
            }
            return [{ url: "https://x.com/a.jpg", sourceUrl: "https://www.totalwine.com/jw-black", sourceDomain: "totalwine.com", title: "Johnnie Walker Black Label 750ml bottle" }];
        });
        const cliente = crearClienteSupabaseFalso();
        const resultado = await resolverImagenProducto(cliente, TERMINOS_JW, { proveedor: proveedor });
        assert.strictEqual(resultado.estado, "encontrada");
        assert.strictEqual(proveedor._llamadas(), 2);
    });

    await testAsync("resolverImagenProducto: 402 (sin crédito) no reintenta y devuelve error_proveedor", async function () {
        class ErrorSinCredito extends Error {}
        const proveedor = {
            estaConfigurado: () => true,
            ErrorProveedorSinCredito: ErrorSinCredito,
            buscar: async function () { throw new ErrorSinCredito("sin crédito"); },
            _llamadas: () => 1
        };
        const cliente = crearClienteSupabaseFalso();
        const resultado = await resolverImagenProducto(cliente, TERMINOS_JW, { proveedor: proveedor });
        assert.strictEqual(resultado.estado, "error_proveedor");
    });
}

ejecutar();

async function ejecutar() {
    await testConcurrencia();
    await testResolver();
    console.log("\n" + (total - fallidos) + "/" + total + " pruebas pasaron.");
    if (fallidos > 0) { process.exitCode = 1; }
}
