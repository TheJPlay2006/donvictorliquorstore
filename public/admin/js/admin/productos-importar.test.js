// Test de la lógica crítica del importador masivo de productos, sin
// framework (el proyecto no usa ninguno): Node + `assert` + `vm`, ejecutado
// con `npm test`. Carga productos-importar.js en un contexto con `window`/
// `document` mínimos y usa los ganchos expuestos en
// `window.__productosImportarTestHooks` (ver el final de ese archivo).
"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var vm = require("vm");
var JSZip = require("jszip");
var Papa = require("papaparse");

var codigoFuente = fs.readFileSync(path.join(__dirname, "productos-importar.js"), "utf8");

function crearContexto() {
    var listeners = {};
    var documentStub = {
        addEventListener: function (evento, manejador) {
            listeners[evento] = manejador;
        },
        querySelector: function () {
            return { value: "crear" };
        }
    };
    var windowStub = {};
    var contexto = {
        window: windowStub,
        document: documentStub,
        console: console,
        Map: Map,
        Set: Set,
        URL: URL,
        Blob: Blob,
        Uint8Array: Uint8Array,
        Promise: Promise,
        JSZip: JSZip,
        Papa: Papa,
        AbortController: typeof AbortController !== "undefined" ? AbortController : undefined,
        fetch: typeof fetch !== "undefined" ? fetch : undefined,
        isFinite: isFinite,
        isNaN: isNaN,
        setTimeout: setTimeout,
        clearTimeout: clearTimeout
    };
    vm.createContext(contexto);
    vm.runInContext(codigoFuente, contexto, { filename: "productos-importar.js" });
    return { contexto: contexto, hooks: windowStub.__productosImportarTestHooks };
}

var total = 0;
var fallidos = 0;

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

console.log("productos-importar.js");
var h = crearContexto().hooks;

// ---- parseNumeroLatino ----
test("precio simple sin separadores", function () {
    assert.strictEqual(h.parseNumeroLatino("18500"), 18500);
});
test("precio con punto de miles (formato CR)", function () {
    assert.strictEqual(h.parseNumeroLatino("18.500"), 18500);
});
test("precio con coma de miles", function () {
    assert.strictEqual(h.parseNumeroLatino("18,500"), 18500);
});
test("precio con coma decimal", function () {
    assert.strictEqual(h.parseNumeroLatino("18500,50"), 18500.5);
});
test("precio con punto decimal", function () {
    assert.strictEqual(h.parseNumeroLatino("18500.50"), 18500.5);
});
test("precio con miles y decimales combinados", function () {
    assert.strictEqual(h.parseNumeroLatino("1.234.567,89"), 1234567.89);
});
test("precio con símbolo de moneda y espacios", function () {
    assert.strictEqual(h.parseNumeroLatino("₡ 9.200"), 9200);
});
test("precio numérico (celda de Excel)", function () {
    assert.strictEqual(h.parseNumeroLatino(9200.5), 9200.5);
});
test("precio vacío es inválido (NaN)", function () {
    assert.ok(isNaN(h.parseNumeroLatino("")));
});
test("precio no numérico es inválido (NaN)", function () {
    assert.ok(isNaN(h.parseNumeroLatino("abc")));
});

// ---- parseBooleano ----
test("booleano reconoce 'true'/'false'", function () {
    assert.strictEqual(h.parseBooleano("true", false).valor, true);
    assert.strictEqual(h.parseBooleano("false", true).valor, false);
});
test("booleano reconoce 'si'/'sí'/'no'", function () {
    assert.strictEqual(h.parseBooleano("si", false).valor, true);
    assert.strictEqual(h.parseBooleano("Sí", false).valor, true);
    assert.strictEqual(h.parseBooleano("no", true).valor, false);
});
test("booleano reconoce '1'/'0'", function () {
    assert.strictEqual(h.parseBooleano("1", false).valor, true);
    assert.strictEqual(h.parseBooleano("0", true).valor, false);
});
test("booleano reconoce 'disponible'/'agotado'", function () {
    assert.strictEqual(h.parseBooleano("disponible", false).valor, true);
    assert.strictEqual(h.parseBooleano("agotado", true).valor, false);
});
test("booleano vacío usa el valor por defecto y se marca reconocido", function () {
    var r = h.parseBooleano("", true);
    assert.strictEqual(r.valor, true);
    assert.strictEqual(r.reconocido, true);
});
test("booleano no reconocido cae al valor por defecto y avisa", function () {
    var r = h.parseBooleano("tal vez", false);
    assert.strictEqual(r.valor, false);
    assert.strictEqual(r.reconocido, false);
});
test("valor ya booleano (celda de Excel) se respeta tal cual", function () {
    assert.strictEqual(h.parseBooleano(true, false).valor, true);
});

// ---- normalizarTexto / categorías ----
test("normalizarTexto ignora mayúsculas y tildes", function () {
    assert.strictEqual(h.normalizarTexto("Whisky"), h.normalizarTexto("WHISKY"));
    assert.strictEqual(h.normalizarTexto("Cristalería"), h.normalizarTexto("cristaleria"));
});

// ---- obtenerNombreBase / path traversal ----
test("obtenerNombreBase toma solo el último segmento", function () {
    assert.strictEqual(h.obtenerNombreBase("imagenes/JW-BLACK-750.jpg"), "JW-BLACK-750.jpg");
});
test("obtenerNombreBase ignora segmentos '..' ", function () {
    assert.strictEqual(h.obtenerNombreBase("../../etc/passwd"), "passwd");
});

// ---- esUrlHttp / validarUrlImagenPermitida ----
test("esUrlHttp acepta http(s) y rechaza otros esquemas", function () {
    assert.strictEqual(h.esUrlHttp("https://example.com/a.jpg"), true);
    assert.strictEqual(h.esUrlHttp("JW-BLACK-750.jpg"), false);
    assert.strictEqual(h.esUrlHttp("ftp://example.com/a.jpg"), false);
});
test("validarUrlImagenPermitida bloquea localhost y redes privadas", function () {
    assert.strictEqual(h.validarUrlImagenPermitida("http://localhost/a.jpg"), false);
    assert.strictEqual(h.validarUrlImagenPermitida("http://127.0.0.1/a.jpg"), false);
    assert.strictEqual(h.validarUrlImagenPermitida("http://192.168.1.5/a.jpg"), false);
    assert.strictEqual(h.validarUrlImagenPermitida("http://10.0.0.5/a.jpg"), false);
});
test("validarUrlImagenPermitida acepta hosts públicos http/https", function () {
    assert.strictEqual(h.validarUrlImagenPermitida("https://example.com/a.jpg"), true);
});
test("validarUrlImagenPermitida rechaza esquemas peligrosos", function () {
    assert.strictEqual(h.validarUrlImagenPermitida("javascript:alert(1)"), false);
    assert.strictEqual(h.validarUrlImagenPermitida("data:image/png;base64,AAAA"), false);
});

// ---- verificarFirmaImagen (magic bytes) ----
test("verificarFirmaImagen valida JPEG/PNG/WEBP reales", function () {
    assert.strictEqual(h.verificarFirmaImagen(new Uint8Array([0xFF, 0xD8, 0xFF, 0, 0, 0, 0, 0, 0, 0, 0, 0]), "image/jpeg"), true);
    assert.strictEqual(h.verificarFirmaImagen(new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0, 0, 0, 0, 0, 0, 0, 0]), "image/png"), true);
    var webp = new Uint8Array(12);
    webp.set([0x52, 0x49, 0x46, 0x46], 0);
    webp.set([0x57, 0x45, 0x42, 0x50], 8);
    assert.strictEqual(h.verificarFirmaImagen(webp, "image/webp"), true);
});
test("verificarFirmaImagen rechaza contenido que no coincide con la extensión", function () {
    // Un HTML/script renombrado a .jpg no debe pasar la validación.
    var htmlComoBytes = new TextEncoder().encode("<html>not an image</html>");
    assert.strictEqual(h.verificarFirmaImagen(htmlComoBytes, "image/jpeg"), false);
});

// ---- validarFila: reglas de negocio ----
function filaBase(overrides) {
    return Object.assign({
        nombre: "Ron Centenario 12", marca: "Centenario", presentacion: "750 ml",
        codigo: "RC-750", descripcion: "Ron añejado", categoria: "Whisky",
        precio: "18500", stock: "10", disponibilidad: "disponible",
        destacado: "true", promocion: "false", activo: "true", imagen: ""
    }, overrides || {});
}

test("fila válida no genera errores", function () {
    h.setCategorias([{ id_categoria: 3, nombre: "Whisky" }]);
    h.setMapaImagenesZip(null);
    var fila = h.validarFila(filaBase(), 0);
    assert.strictEqual(fila.errores.length, 0);
    assert.strictEqual(fila.idCategoria, 3);
});

test("categoría se reconoce sin importar mayúsculas/tildes", function () {
    h.setCategorias([{ id_categoria: 10, nombre: "Cristalería y coctelería" }]);
    var fila = h.validarFila(filaBase({ categoria: "cristaleria y cocteleria" }), 0);
    assert.strictEqual(fila.idCategoria, 10);
    assert.strictEqual(fila.errores.length, 0);
});

test("categoría inexistente produce un error explícito", function () {
    h.setCategorias([{ id_categoria: 3, nombre: "Whisky" }]);
    var fila = h.validarFila(filaBase({ categoria: "Cervezas Importadas" }), 16);
    assert.ok(fila.errores.some(function (m) { return /Cervezas Importadas.*no existe/.test(m); }));
    assert.strictEqual(fila.numeroFila, 18);
});

test("nombre vacío es error", function () {
    h.setCategorias([{ id_categoria: 3, nombre: "Whisky" }]);
    var fila = h.validarFila(filaBase({ nombre: "  " }), 0);
    assert.ok(fila.errores.some(function (m) { return /nombre es obligatorio/.test(m); }));
});

test("precio inválido es error", function () {
    h.setCategorias([{ id_categoria: 3, nombre: "Whisky" }]);
    var fila = h.validarFila(filaBase({ precio: "no-es-un-precio" }), 0);
    assert.ok(fila.errores.some(function (m) { return /precio no es válido/.test(m); }));
});

test("precio negativo es error", function () {
    h.setCategorias([{ id_categoria: 3, nombre: "Whisky" }]);
    var fila = h.validarFila(filaBase({ precio: "-100" }), 0);
    assert.ok(fila.errores.some(function (m) { return /precio no es válido/.test(m); }));
});

test("stock no entero es error", function () {
    h.setCategorias([{ id_categoria: 3, nombre: "Whisky" }]);
    var fila = h.validarFila(filaBase({ stock: "3.5" }), 0);
    assert.ok(fila.errores.some(function (m) { return /entero/.test(m); }));
});

test("booleano no reconocido agrega advertencia, no error, y usa el valor por defecto", function () {
    h.setCategorias([{ id_categoria: 3, nombre: "Whisky" }]);
    var fila = h.validarFila(filaBase({ destacado: "tal vez" }), 0);
    assert.strictEqual(fila.errores.length, 0);
    assert.ok(fila.advertencias.some(function (m) { return /destacado/.test(m); }));
    assert.strictEqual(fila.destacado, false);
});

test("imagen ausente sin ZIP cargado es advertencia, no bloquea la fila", function () {
    h.setCategorias([{ id_categoria: 3, nombre: "Whisky" }]);
    h.setMapaImagenesZip(null);
    var fila = h.validarFila(filaBase({ imagen: "foto.jpg" }), 0);
    assert.strictEqual(fila.errores.length, 0);
    assert.ok(fila.advertencias.some(function (m) { return /no se cargó ningún ZIP/.test(m); }));
});

test("imagen por URL se detecta como tipo 'url'", function () {
    h.setCategorias([{ id_categoria: 3, nombre: "Whisky" }]);
    var fila = h.validarFila(filaBase({ imagen: "https://example.com/a.jpg" }), 0);
    assert.strictEqual(fila.resolucionImagen.tipo, "url");
});

// ---- leerCsv: CSV real (BOM, comas dentro de campos, encabezados) ----
async function ejecutarPruebasCsv() {
    var hooks = crearContexto().hooks;

    var encabezado = "nombre,marca,presentacion,codigo,descripcion,categoria,precio,stock,disponibilidad,destacado,promocion,activo,imagen";
    var filaConComasYTildes = 'Johnnie Walker,Johnnie Walker,750 ml,JW-1,"Whisky escocés, 12 años, edición especial",Whisky,18500,12,disponible,true,false,true,JW-1.jpg';
    var csvConBom = "﻿" + encabezado + "\n" + filaConComasYTildes + "\n";

    var filas = await hooks.leerCsv(csvConBom);

    test("leerCsv soporta BOM UTF-8 (el primer encabezado no queda con basura)", function () {
        assert.strictEqual(Object.keys(filas[0])[0], "nombre");
    });

    test("leerCsv respeta comas dentro de un campo entre comillas", function () {
        assert.strictEqual(filas[0].descripcion, "Whisky escocés, 12 años, edición especial");
        assert.strictEqual(filas[0].codigo, "JW-1");
        assert.strictEqual(filas[0].precio, "18500");
    });

    var csvMayusculas = "NOMBRE,CODIGO\nAbsolut,ABS-1\n";
    var filasMayus = await hooks.leerCsv(csvMayusculas);
    test("leerCsv normaliza encabezados a minúsculas (tolera 'NOMBRE' en vez de 'nombre')", function () {
        assert.strictEqual(filasMayus[0].nombre, "Absolut");
        assert.strictEqual(filasMayus[0].codigo, "ABS-1");
    });
}

// ---- resolverImagenFila: fallback por código + ZIP ----
async function ejecutarPruebasZip() {
    var zip = new JSZip();
    zip.file("imagenes/RC-750.jpg", new Uint8Array([1, 2, 3]));
    zip.file("otros/no-imagen.txt", "hola");
    var buffer = await zip.generateAsync({ type: "nodebuffer" });

    var { hooks } = crearContexto();
    hooks.setCategorias([{ id_categoria: 3, nombre: "Whisky" }]);

    var JSZipEnContexto = require("jszip");
    var zipCargado = await JSZipEnContexto.loadAsync(buffer);
    var mapa = new Map();
    Object.keys(zipCargado.files).forEach(function (nombre) {
        var entrada = zipCargado.files[nombre];
        if (entrada.dir) { return; }
        var base = nombre.split("/").pop();
        var ext = (base.split(".").pop() || "").toLowerCase();
        if (["jpg", "jpeg", "png", "webp"].indexOf(ext) === -1) { return; }
        mapa.set(base.toLowerCase(), { entry: entrada, ext: ext, mime: "image/jpeg" });
    });
    hooks.setMapaImagenesZip(mapa);

    test("imagen vacía usa el código de producto como fallback dentro del ZIP", function () {
        var fila = hooks.validarFila(filaBase({ imagen: "" }), 0);
        assert.strictEqual(fila.resolucionImagen.tipo, "zip");
        assert.strictEqual(fila.resolucionImagen.porCodigo, true);
    });

    test("imagen indicada explícitamente por nombre se encuentra dentro de una carpeta del ZIP", function () {
        var fila = hooks.validarFila(filaBase({ imagen: "RC-750.jpg", codigo: "OTRO" }), 0);
        assert.strictEqual(fila.resolucionImagen.tipo, "zip");
    });

    test("imagen indicada que no existe en el ZIP es advertencia, no bloquea la fila", function () {
        var fila = hooks.validarFila(filaBase({ imagen: "no-existe.jpg" }), 0);
        assert.strictEqual(fila.errores.length, 0);
        assert.ok(fila.advertencias.some(function (m) { return /no encontrada en el ZIP/.test(m); }));
    });
}

// JSZip normaliza/colapsa "../" cuando uno arma el ZIP con su propia API de
// escritura (zip.file(...)), así que para probar de verdad la defensa contra
// path traversal hace falta un ZIP crudo con el nombre de entrada literal
// "../../fuera-del-zip.jpg" en el central directory — como lo tendría un ZIP
// armado a mano o con otra herramienta. Se arma manualmente (método STORE,
// sin compresión) en vez de depender de JSZip para escribirlo.
function construirZipCrudo(entradas) {
    var zlib = require("zlib");
    var partesLocales = [];
    var partesCentral = [];
    var offset = 0;

    entradas.forEach(function (entrada) {
        var nombre = Buffer.from(entrada.nombre, "utf8");
        var contenido = Buffer.isBuffer(entrada.contenido) ? entrada.contenido : Buffer.from(entrada.contenido);
        var crc = zlib.crc32(contenido) >>> 0;

        var local = Buffer.alloc(30 + nombre.length);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4);
        local.writeUInt16LE(0, 6);
        local.writeUInt16LE(0, 8);
        local.writeUInt16LE(0, 10);
        local.writeUInt16LE(0, 12);
        local.writeUInt32LE(crc, 14);
        local.writeUInt32LE(contenido.length, 18);
        local.writeUInt32LE(contenido.length, 22);
        local.writeUInt16LE(nombre.length, 26);
        local.writeUInt16LE(0, 28);
        nombre.copy(local, 30);

        partesLocales.push(local, contenido);

        var central = Buffer.alloc(46 + nombre.length);
        central.writeUInt32LE(0x02014b50, 0);
        central.writeUInt16LE(20, 4);
        central.writeUInt16LE(20, 6);
        central.writeUInt16LE(0, 8);
        central.writeUInt16LE(0, 10);
        central.writeUInt16LE(0, 12);
        central.writeUInt16LE(0, 14);
        central.writeUInt32LE(crc, 16);
        central.writeUInt32LE(contenido.length, 20);
        central.writeUInt32LE(contenido.length, 24);
        central.writeUInt16LE(nombre.length, 28);
        central.writeUInt16LE(0, 30);
        central.writeUInt16LE(0, 32);
        central.writeUInt16LE(0, 34);
        central.writeUInt16LE(0, 36);
        central.writeUInt32LE(0, 38);
        central.writeUInt32LE(offset, 42);
        nombre.copy(central, 46);

        partesCentral.push(central);
        offset += local.length + contenido.length;
    });

    var centralDirectorio = Buffer.concat(partesCentral);
    var finalCentral = offset;

    var fin = Buffer.alloc(22);
    fin.writeUInt32LE(0x06054b50, 0);
    fin.writeUInt16LE(0, 4);
    fin.writeUInt16LE(0, 6);
    fin.writeUInt16LE(entradas.length, 8);
    fin.writeUInt16LE(entradas.length, 10);
    fin.writeUInt32LE(centralDirectorio.length, 12);
    fin.writeUInt32LE(finalCentral, 16);
    fin.writeUInt16LE(0, 20);

    return Buffer.concat(partesLocales.concat([centralDirectorio, fin]));
}

async function ejecutarPruebaPathTraversal() {
    var buffer = construirZipCrudo([
        // Un ZIP armado a mano (no con la API de escritura de JSZip) sí
        // puede llevar un nombre de entrada literal con "..": esto reproduce
        // ese caso en el central directory.
        { nombre: "../../fuera-del-zip.jpg", contenido: Buffer.from([1, 2, 3]) },
        { nombre: "normal.jpg", contenido: Buffer.from([1, 2, 3]) },
        { nombre: "notas.txt", contenido: Buffer.from("esto no es una imagen, se debe ignorar") }
    ]);

    var hooks = crearContexto().hooks;
    var resultado = await hooks.procesarZip(buffer);

    test("procesarZip nunca deja una entrada cuyo nombre resuelto contenga '..'", function () {
        // JSZip.loadAsync ya neutraliza "../" al leer (colapsa la ruta), y
        // nuestro propio filtro contienePathTraversal() es una segunda capa
        // de defensa: cualquiera de las dos formas, ninguna clave del mapa
        // final puede escapar de la carpeta virtual del ZIP.
        Array.from(resultado.mapa.keys()).forEach(function (clave) {
            assert.strictEqual(hooks.contienePathTraversal(clave), false);
        });
        assert.strictEqual(resultado.mapa.has("normal.jpg"), true);
    });

    test("contienePathTraversal detecta segmentos '..' de forma aislada", function () {
        assert.strictEqual(hooks.contienePathTraversal("../../fuera-del-zip.jpg"), true);
        assert.strictEqual(hooks.contienePathTraversal("imagenes/../secreto.jpg"), true);
        assert.strictEqual(hooks.contienePathTraversal("imagenes/normal.jpg"), false);
    });

    test("procesarZip ignora archivos que no son imágenes", function () {
        assert.strictEqual(resultado.mapa.has("notas.txt"), false);
        assert.ok(resultado.ignorados >= 1);
    });
}

ejecutarPruebasCsv()
    .then(ejecutarPruebasZip)
    .then(ejecutarPruebaPathTraversal)
    .then(function () {
        console.log("\n" + (total - fallidos) + "/" + total + " pruebas pasaron.");
        if (fallidos > 0) {
            process.exitCode = 1;
        }
    })
    .catch(function (error) {
        console.error("Error inesperado ejecutando las pruebas:", error);
        process.exitCode = 1;
    });
