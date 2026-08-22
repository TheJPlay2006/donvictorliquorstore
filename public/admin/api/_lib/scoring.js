// Scoring de candidatos de imagen encontrados por búsqueda automática.
// Lógica pura (sin red, sin DB) — ver api/_lib/imageSearch.test.js.
//
// Separa IDENTIDAD (¿es el producto correcto, la variante correcta, la
// presentación correcta?) de CALIDAD (¿es una foto de producto decente, o
// un estante de supermercado?). Un conflicto de identidad (marca distinta,
// variante distinta, edad distinta) es un RECHAZO duro — ninguna cantidad
// de buena calidad de imagen lo puede compensar (§26). Simétricamente, una
// calidad pésima (foto de estante/colección) nunca llega a "alta" aunque el
// texto coincida perfecto (§27): "alta" exige AMBOS scores por separado, no
// solo un puntaje combinado.
"use strict";

const { normalizarTexto, tokenizar, presentacionAMililitros, extraerNumeroEdad } = require("./texto");

const UMBRAL_IDENTIDAD_ALTA = 70;
const UMBRAL_IDENTIDAD_MEDIA = 40;
const UMBRAL_CALIDAD_ALTA_MINIMA = 30; // calidad mínima para poder llegar a "alta" aunque la identidad sea perfecta
const UMBRAL_CALIDAD_BAJA = 10; // por debajo de esto, ni "media" (foto casi con certeza no sirve)

const PESOS = {
    barcodeExacto: 60,
    marcaCoincideTotal: 30,
    marcaCoincideParcial: 12,
    nombreCoincideMax: 40,
    presentacionCoincide: 20,
    contieneBottle: 6,
    dimensionGrande: 20,
    dimensionAceptable: 10,
    dimensionMuyChica: -60,
    aspectRatioProducto: 12,
    fuenteConfiable: 15,
    fuentePenalizada: -30
};

// Grupos de variantes de producto mutuamente excluyentes, agrupadas por
// CLUSTERS de sinónimos: dos clusters del MISMO grupo son un conflicto real
// (Blanco vs Reposado), pero dos sinónimos del MISMO cluster no lo son
// (Blanco ~ Silver ~ Plata son la misma variante, no compiten entre sí).
const GRUPOS_VARIANTES = [
    [["black label"], ["red label"], ["blue label"], ["gold label"], ["green label"], ["double black"]],
    [["blanco", "silver", "plata"], ["reposado"], ["anejo"], ["cristalino"], ["extra anejo"]],
    [["carta blanca"], ["carta oro"]],
    [["original"], ["light"], ["zero"]]
];

// Nivel 1: fuerza la confianza a "baja" sin importar el resto del score —
// casi siempre son estantes/colecciones/contexto, no el producto en sí (§19).
// "ingredients"/"nutrition"/"back label" quedan acá (no como penalización
// suave): son casi siempre la parte de ATRÁS de la botella, nunca la foto
// de portada que queremos (caso real detectado: "Corona france
// ingredients.jpg" pasaba como alta con una penalización débil).
const PALABRAS_TOPE_BAJA = [
    "supermarket", "store", "shop", "shelf", "shelves", "display", "collection",
    "assortment", "bottles of", "multiple bottles", "ingredients", "nutrition",
    "back label", "back of"
];

// Nivel 2: penalización fuerte a la calidad, sin forzar el tope (§18).
const PALABRAS_PENALIZADAS_CALIDAD = {
    bar: -15, party: -25, weekend: -25, celebration: -20, event: -15, cocktail: -20,
    recipe: -20, glass: -15, restaurant: -15, advertisement: -35, advertising: -35,
    poster: -30, sign: -15, banner: -35, museum: -10, bottom: -20, box: -15,
    boxed: -15, "gift set": -15, miniatures: -20, logo: -35, menu: -20,
    set: -10, pack: -10, case: -10
};

const DOMINIOS_CONFIABLES = [
    "totalwine.com", "thewhiskyexchange.com", "masterofmalt.com", "wine.com",
    "drizly.com", "reservebar.com", "klwines.com", "thedrinkshop.com",
    "wikipedia.org", "wikimedia.org", "openfoodfacts.org", "diageo.com",
    "pernod-ricard.com", "absolut.com", "bacardi.com", "brown-forman.com",
    "remy-cointreau.com", "campari.com", "beveragedynasty.com", "finedrams.com",
    "liquorama.net"
];

const DOMINIOS_PENALIZADOS = [
    "pinterest.", "instagram.com", "facebook.com", "twitter.com", "x.com",
    "tiktok.com", "istockphoto.com", "shutterstock.com", "gettyimages.com",
    "alamy.com", "reddit.com", "youtube.com"
];

// Fuentes cuya licencia SÍ se conoce con certeza (Open Food Facts/Wikimedia/
// Openverse siempre informan license). Cualquier otra fuente (ej. UPCitemdb,
// que trae fotos de catálogos de retail sin licencia explícita) nunca puede
// llegar a "alta": no tenemos base para asumir que se puede reutilizar
// comercialmente solo porque el producto matchea perfecto (§59).
const FUENTES_CON_LICENCIA_CONOCIDA = ["openfoodfacts", "wikimedia", "openverse"];

function extraerDominio(urlTexto) {
    try {
        return new URL(urlTexto).hostname.replace(/^www\./, "").toLowerCase();
    } catch (error) {
        return "";
    }
}

function coincideDominio(dominio, lista) {
    return lista.some((patron) => dominio === patron || dominio.endsWith("." + patron) || dominio.indexOf(patron) !== -1);
}

function clusterEnGrupo(grupo, textoNormalizado) {
    for (let i = 0; i < grupo.length; i++) {
        if (grupo[i].some((sinonimo) => textoNormalizado.indexOf(sinonimo) !== -1)) { return i; }
    }
    return -1;
}

// Devuelve un motivo de rechazo duro ("VARIANT_CONFLICT"/"AGE_CONFLICT") o
// null si no hay conflicto de identidad detectado.
function detectarConflictoIdentidad(candidato, terminos, textoCandidato) {
    if (terminos.nombre) {
        const textoNombre = normalizarTexto(terminos.nombre);
        for (let g = 0; g < GRUPOS_VARIANTES.length; g++) {
            const esperado = clusterEnGrupo(GRUPOS_VARIANTES[g], textoNombre);
            if (esperado === -1) { continue; }
            const encontrado = clusterEnGrupo(GRUPOS_VARIANTES[g], textoCandidato);
            if (encontrado !== -1 && encontrado !== esperado) {
                return { motivo: "VARIANT_CONFLICT", esperado: GRUPOS_VARIANTES[g][esperado][0], encontrado: GRUPOS_VARIANTES[g][encontrado][0] };
            }
        }

        const edadEsperada = extraerNumeroEdad(terminos.nombre, terminos.marca);
        const edadCandidato = extraerNumeroEdad(textoCandidato);
        if (edadEsperada !== null && edadCandidato !== null && edadEsperada !== edadCandidato) {
            return { motivo: "AGE_CONFLICT", esperado: edadEsperada, encontrado: edadCandidato };
        }
    }
    return null;
}

// terminos: { marca, nombre, presentacion, codigo, barcode }
// candidato: { title, description, url, sourceUrl, sourceDomain, width,
//              height, fuente, offBrand, offQuantity, license }
function calcularScore(candidato, terminos) {
    const razones = [];
    const textoCandidato = normalizarTexto(
        (candidato.title || "") + " " + (candidato.description || "") + " " + (candidato.sourceUrl || candidato.url || "")
    );
    const dominio = candidato.sourceDomain || extraerDominio(candidato.sourceUrl || candidato.url || "");

    const conflicto = detectarConflictoIdentidad(candidato, terminos, textoCandidato);
    if (conflicto) {
        const mensaje = conflicto.motivo === "AGE_CONFLICT"
            ? "candidato rechazado: edad distinta (esperado " + conflicto.esperado + ", encontrado " + conflicto.encontrado + ")"
            : 'candidato rechazado: variante distinta ("' + conflicto.encontrado + '" vs "' + conflicto.esperado + '")';
        return {
            identityScore: 0, qualityScore: 0, score: 0, rechazado: true,
            motivoRechazo: conflicto.motivo, dominio: dominio, razones: [mensaje]
        };
    }

    // Un caption/descripción de Wikimedia puede NOMBRAR el producto sin que
    // la foto SEA del producto (ej. una foto de "fin de semana con amigos"
    // cuya descripción dice "se ve una botella de Patrón Silver de fondo").
    // El título del archivo es una señal mucho más confiable que la
    // descripción — si el producto no aparece ni en el título NI en la URL,
    // no alcanza para "alta" aunque la descripción lo mencione (caso real
    // detectado: "Bring on the Weekend!.jpg" pasaba como alta por su caption).
    const textoTituloYUrl = normalizarTexto((candidato.title || "") + " " + (candidato.sourceUrl || candidato.url || ""));
    const tokensIdentidad = [].concat(terminos.marca ? tokenizar(terminos.marca) : [], terminos.nombre ? tokenizar(terminos.nombre).filter((t) => t.length >= 3) : []);
    const productoNombradoEnTitulo = candidato.fuente === "openfoodfacts" ||
        tokensIdentidad.length === 0 ||
        tokensIdentidad.some((t) => textoTituloYUrl.indexOf(t) !== -1);

    // ---------------- IDENTIDAD ----------------
    let identityScore = 0;

    if (candidato.fuente === "openfoodfacts") {
        identityScore += PESOS.barcodeExacto;
        razones.push("barcode exacto (+" + PESOS.barcodeExacto + ")");

        if (candidato.offBrand && terminos.marca) {
            const off = normalizarTexto(candidato.offBrand);
            const hayCoincidencia = tokenizar(terminos.marca).some((t) => off.indexOf(t) !== -1);
            if (!hayCoincidencia) {
                identityScore -= 40;
                razones.push('Open Food Facts reporta otra marca ("' + candidato.offBrand + '") (-40)');
            }
        }
        if (candidato.offQuantity && terminos.presentacion) {
            const mlOff = presentacionAMililitros(candidato.offQuantity);
            const mlPedido = presentacionAMililitros(terminos.presentacion);
            if (mlOff && mlPedido && mlOff !== mlPedido) {
                identityScore -= 25;
                razones.push("Open Food Facts reporta otra presentación (" + candidato.offQuantity + ") (-25)");
            }
        }
    }

    if (terminos.marca) {
        const tokensMarca = tokenizar(terminos.marca);
        const encontrados = tokensMarca.filter((t) => textoCandidato.indexOf(t) !== -1);
        if (tokensMarca.length > 0 && encontrados.length === tokensMarca.length) {
            identityScore += PESOS.marcaCoincideTotal;
            razones.push("marca coincide (+" + PESOS.marcaCoincideTotal + ")");
        } else if (encontrados.length > 0) {
            identityScore += PESOS.marcaCoincideParcial;
            razones.push("marca coincide parcialmente (+" + PESOS.marcaCoincideParcial + ")");
        } else if (candidato.fuente !== "openfoodfacts") {
            razones.push("marca no se menciona en el candidato (+0)");
        }
    }

    if (terminos.nombre) {
        const tokensNombre = tokenizar(terminos.nombre);
        const relevantes = tokensNombre.filter((t) => t.length >= 3);
        const base = relevantes.length || tokensNombre.length;
        if (base > 0) {
            const encontrados = (relevantes.length ? relevantes : tokensNombre).filter((t) => textoCandidato.indexOf(t) !== -1);
            const proporcion = encontrados.length / base;
            const puntos = Math.round(proporcion * PESOS.nombreCoincideMax);
            if (puntos > 0) {
                identityScore += puntos;
                razones.push("nombre coincide " + Math.round(proporcion * 100) + "% (+" + puntos + ")");
            }
        }
    }

    if (terminos.presentacion) {
        const mlPedido = presentacionAMililitros(terminos.presentacion);
        const mlCandidato = presentacionAMililitros(textoCandidato);
        if (mlPedido && mlCandidato) {
            if (mlPedido === mlCandidato) {
                identityScore += PESOS.presentacionCoincide;
                razones.push("presentación coincide (+" + PESOS.presentacionCoincide + ")");
            } else {
                identityScore -= 40;
                razones.push("presentación distinta (-40)");
            }
        } else {
            const presentacionTexto = normalizarTexto(terminos.presentacion).replace(/\s+/g, "");
            if (presentacionTexto && textoCandidato.replace(/\s+/g, "").indexOf(presentacionTexto) !== -1) {
                identityScore += PESOS.presentacionCoincide;
                razones.push("presentación coincide (+" + PESOS.presentacionCoincide + ")");
            }
        }
    }

    identityScore = Math.max(0, Math.min(100, identityScore));

    // ---------------- CALIDAD ----------------
    let qualityScore = 50; // base neutral

    if (textoCandidato.indexOf("bottle") !== -1) {
        qualityScore += PESOS.contieneBottle;
        razones.push('título contiene "bottle" (+' + PESOS.contieneBottle + ")");
    }

    const ladoMayor = Math.max(candidato.width || 0, candidato.height || 0);
    if (ladoMayor > 0) {
        if (ladoMayor >= 1000) {
            qualityScore += PESOS.dimensionGrande;
            razones.push("buena resolución (+" + PESOS.dimensionGrande + ")");
        } else if (ladoMayor >= 600) {
            qualityScore += PESOS.dimensionAceptable;
            razones.push("resolución aceptable (+" + PESOS.dimensionAceptable + ")");
        } else if (ladoMayor < 200) {
            qualityScore += PESOS.dimensionMuyChica;
            razones.push("imagen muy pequeña (" + PESOS.dimensionMuyChica + ")");
        }
        if (candidato.width && candidato.height) {
            const ratio = candidato.width / candidato.height;
            if (ratio >= 0.35 && ratio <= 1.2) {
                qualityScore += PESOS.aspectRatioProducto;
                razones.push("proporción típica de producto (+" + PESOS.aspectRatioProducto + ")");
            }
        }
    }

    if (dominio) {
        if (coincideDominio(dominio, DOMINIOS_CONFIABLES)) {
            qualityScore += PESOS.fuenteConfiable;
            razones.push("fuente confiable: " + dominio + " (+" + PESOS.fuenteConfiable + ")");
        } else if (coincideDominio(dominio, DOMINIOS_PENALIZADOS)) {
            qualityScore += PESOS.fuentePenalizada;
            razones.push("fuente de banco de imágenes/red social: " + dominio + " (" + PESOS.fuentePenalizada + ")");
        }
    }

    Object.keys(PALABRAS_PENALIZADAS_CALIDAD).forEach((palabra) => {
        if (textoCandidato.indexOf(palabra) !== -1) {
            qualityScore += PALABRAS_PENALIZADAS_CALIDAD[palabra];
            razones.push('menciona "' + palabra + '" (' + PALABRAS_PENALIZADAS_CALIDAD[palabra] + ")");
        }
    });

    const tienePalabraTopeBaja = PALABRAS_TOPE_BAJA.some((palabra) => textoCandidato.indexOf(palabra) !== -1);
    if (tienePalabraTopeBaja) {
        razones.push("título sugiere estante/colección/tienda — confianza tope: baja");
    }

    qualityScore = Math.max(0, Math.min(100, qualityScore));

    const licenciaDesconocida = FUENTES_CON_LICENCIA_CONOCIDA.indexOf(candidato.fuente) === -1;
    if (licenciaDesconocida) {
        razones.push("licencia no confirmada (fuente: " + (candidato.fuente || "?") + ") — no puede llegar a alta confianza");
    }

    if (!productoNombradoEnTitulo) {
        razones.push("el producto no aparece en el título del archivo, solo en la descripción — no puede llegar a alta confianza");
    }

    const score = Math.round(identityScore * 0.6 + qualityScore * 0.4);

    return {
        identityScore, qualityScore, score, rechazado: false,
        tienePalabraTopeBaja, licenciaDesconocida, productoNombradoEnTitulo, dominio, razones
    };
}

// La confianza NO es solo el score combinado: "alta" exige identidad fuerte
// Y calidad al menos aceptable (§25/§26/§27), y ninguna palabra de "estante/
// tienda" ni licencia desconocida puede llegar a alta (§19/§59). Tampoco
// llega a "alta" un match que solo viene de la descripción/caption, nunca
// del título del archivo (ver comentario junto a `productoNombradoEnTitulo`).
function confianzaDe(resultado) {
    if (resultado.rechazado) { return "baja"; }
    if (resultado.tienePalabraTopeBaja) { return "baja"; }
    if (resultado.qualityScore < UMBRAL_CALIDAD_BAJA) { return "baja"; }

    if (resultado.identityScore >= UMBRAL_IDENTIDAD_ALTA &&
        resultado.qualityScore >= UMBRAL_CALIDAD_ALTA_MINIMA &&
        !resultado.licenciaDesconocida &&
        resultado.productoNombradoEnTitulo) {
        return "alta";
    }
    if (resultado.identityScore >= UMBRAL_IDENTIDAD_MEDIA) { return "media"; }
    return "baja";
}

// Compat: algunos llamadores/tests antiguos solo quieren un número.
function confianzaDeScore(score) {
    if (score >= 80) { return "alta"; }
    if (score >= 55) { return "media"; }
    return "baja";
}

// Ordena y anota candidatos con su score/confianza. `terminos` son los datos
// del producto usados para hacer matching (ver calcularScore).
function evaluarCandidatos(candidatos, terminos) {
    return candidatos
        .map((candidato) => {
            const resultado = calcularScore(candidato, terminos);
            return Object.assign({}, candidato, {
                score: resultado.score,
                identityScore: resultado.identityScore,
                qualityScore: resultado.qualityScore,
                confianza: confianzaDe(resultado),
                rechazado: resultado.rechazado,
                razones: resultado.razones,
                sourceDomain: resultado.dominio
            });
        })
        .sort((a, b) => b.score - a.score);
}

module.exports = {
    calcularScore, confianzaDe, confianzaDeScore, evaluarCandidatos,
    detectarConflictoIdentidad, extraerDominio, PESOS
};
