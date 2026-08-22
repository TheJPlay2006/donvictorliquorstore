// Scoring de candidatos de imagen encontrados por búsqueda automática. Lógica
// pura (sin red, sin DB) para que sea fácil de testear de forma aislada —
// ver api/_lib/imageSearch.test.js. Los pesos son deliberadamente simples y
// están todos juntos en PESOS para poder ajustarlos sin tocar la lógica.
"use strict";

const { normalizarTexto, tokenizar, presentacionAMililitros } = require("./texto");

const PESOS = {
    barcodeExacto: 100,
    marcaCoincideTotal: 35,
    marcaCoincideParcial: 15,
    marcaDistinta: -60,
    nombreCoincideMax: 45, // se escala por % de tokens encontrados
    varianteDistinta: -60, // "Black Label" pedido, "Red Label" encontrado
    presentacionCoincide: 20,
    presentacionDistinta: -30,
    contieneBottle: 5,
    dimensionGrande: 15, // lado mayor >= 1000px
    dimensionAceptable: 8, // lado mayor >= 600px
    dimensionMuyChica: -50, // lado mayor < 200px
    aspectRatioProducto: 10,
    fuenteConfiable: 10,
    fuentePenalizada: -25
};

// Grupos de variantes de producto mutuamente excluyentes: si el nombre pide
// una y el candidato menciona OTRA del mismo grupo, es casi seguro la
// botella equivocada (§21) — Johnnie Walker Black vs Red, Don Julio Blanco
// vs Reposado vs Añejo, etc. No es una lista cerrada, solo cubre los casos
// más comunes de licorería.
const GRUPOS_VARIANTES = [
    ["black label", "red label", "blue label", "gold label", "green label", "double black"],
    ["blanco", "reposado", "anejo", "cristalino"],
    ["original", "light", "zero"],
    ["silver", "gold"]
];

const PALABRAS_PENALIZADAS = {
    logo: -40,
    banner: -35,
    advertisement: -35,
    advertising: -35,
    poster: -30,
    cocktail: -20,
    recipe: -20,
    menu: -20,
    party: -20,
    bar: -15,
    glass: -15,
    sign: -15,
    event: -15
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

function grupoVarianteEn(textoNormalizado) {
    for (let i = 0; i < GRUPOS_VARIANTES.length; i++) {
        const grupo = GRUPOS_VARIANTES[i];
        const encontrada = grupo.find((palabra) => textoNormalizado.indexOf(palabra) !== -1);
        if (encontrada) { return { grupo: i, palabra: encontrada }; }
    }
    return null;
}

// terminos: { marca, nombre, presentacion, codigo, barcode }
// candidato: { title, description, url, sourceUrl, sourceDomain, width,
//              height, fuente, offBrand, offQuantity }
function calcularScore(candidato, terminos) {
    const razones = [];
    let score = 0;

    const textoCandidato = normalizarTexto(
        (candidato.title || "") + " " + (candidato.description || "") + " " + (candidato.sourceUrl || candidato.url || "")
    );
    const dominio = candidato.sourceDomain || extraerDominio(candidato.sourceUrl || candidato.url || "");

    // --- Open Food Facts: el barcode ya identificó el producto exacto ---
    if (candidato.fuente === "openfoodfacts") {
        score += PESOS.barcodeExacto;
        razones.push("barcode exacto (+" + PESOS.barcodeExacto + ")");

        // Pero igual se valida contra los datos que el propio OFF devolvió
        // (§7): si la marca que OFF reporta no tiene nada que ver con la
        // nuestra, o la cantidad no coincide, no confiar ciegamente.
        if (candidato.offBrand && terminos.marca) {
            const tokensMarcaPedida = tokenizar(terminos.marca);
            const off = normalizarTexto(candidato.offBrand);
            const hayCoincidencia = tokensMarcaPedida.some((t) => off.indexOf(t) !== -1);
            if (!hayCoincidencia) {
                score += PESOS.marcaDistinta;
                razones.push('Open Food Facts reporta otra marca ("' + candidato.offBrand + '") (' + PESOS.marcaDistinta + ")");
            }
        }

        if (candidato.offQuantity && terminos.presentacion) {
            const mlOff = presentacionAMililitros(candidato.offQuantity);
            const mlPedido = presentacionAMililitros(terminos.presentacion);
            if (mlOff && mlPedido && mlOff !== mlPedido) {
                score += PESOS.presentacionDistinta;
                razones.push("Open Food Facts reporta otra presentación (" + candidato.offQuantity + ") (" + PESOS.presentacionDistinta + ")");
            }
        }
    }

    // --- Marca ---
    if (terminos.marca) {
        const tokensMarca = tokenizar(terminos.marca);
        const encontrados = tokensMarca.filter((t) => textoCandidato.indexOf(t) !== -1);
        if (tokensMarca.length > 0 && encontrados.length === tokensMarca.length) {
            score += PESOS.marcaCoincideTotal;
            razones.push("marca coincide (+" + PESOS.marcaCoincideTotal + ")");
        } else if (encontrados.length > 0) {
            score += PESOS.marcaCoincideParcial;
            razones.push("marca coincide parcialmente (+" + PESOS.marcaCoincideParcial + ")");
        } else if (candidato.fuente !== "openfoodfacts") {
            // OFF ya se penalizó arriba con su propio mensaje si correspondía.
            score += PESOS.marcaDistinta;
            razones.push("marca no se menciona / posible marca distinta (" + PESOS.marcaDistinta + ")");
        }
    }

    // --- Nombre del producto ---
    if (terminos.nombre) {
        const tokensNombre = tokenizar(terminos.nombre);
        const relevantes = tokensNombre.filter((t) => t.length >= 3);
        const base = relevantes.length || tokensNombre.length;
        if (base > 0) {
            const encontrados = (relevantes.length ? relevantes : tokensNombre).filter((t) => textoCandidato.indexOf(t) !== -1);
            const proporcion = encontrados.length / base;
            const puntos = Math.round(proporcion * PESOS.nombreCoincideMax);
            if (puntos > 0) {
                score += puntos;
                razones.push("nombre coincide " + Math.round(proporcion * 100) + "% (+" + puntos + ")");
            }
        }
    }

    // --- Variante específica (evita asignar Red Label a un Black Label) ---
    const varianteEsperada = terminos.nombre ? grupoVarianteEn(normalizarTexto(terminos.nombre)) : null;
    const varianteEncontrada = grupoVarianteEn(textoCandidato);
    if (varianteEsperada && varianteEncontrada &&
        varianteEsperada.grupo === varianteEncontrada.grupo &&
        varianteEsperada.palabra !== varianteEncontrada.palabra) {
        score += PESOS.varianteDistinta;
        razones.push('variante distinta ("' + varianteEncontrada.palabra + '" vs "' + varianteEsperada.palabra + '") (' + PESOS.varianteDistinta + ")");
    }

    // --- Presentación (750 ml, 1 L, etc. — comparación numérica cuando se puede) ---
    if (terminos.presentacion) {
        const mlPedido = presentacionAMililitros(terminos.presentacion);
        const mlCandidato = presentacionAMililitros(textoCandidato);
        if (mlPedido && mlCandidato) {
            if (mlPedido === mlCandidato) {
                score += PESOS.presentacionCoincide;
                razones.push("presentación coincide (+" + PESOS.presentacionCoincide + ")");
            } else {
                score += PESOS.presentacionDistinta;
                razones.push("presentación distinta (" + PESOS.presentacionDistinta + ")");
            }
        } else {
            const presentacionTexto = normalizarTexto(terminos.presentacion).replace(/\s+/g, "");
            if (presentacionTexto && textoCandidato.replace(/\s+/g, "").indexOf(presentacionTexto) !== -1) {
                score += PESOS.presentacionCoincide;
                razones.push("presentación coincide (+" + PESOS.presentacionCoincide + ")");
            }
        }
    }

    if (textoCandidato.indexOf("bottle") !== -1) {
        score += PESOS.contieneBottle;
        razones.push('título contiene "bottle" (+' + PESOS.contieneBottle + ")");
    }

    // --- Dimensiones ---
    const ladoMayor = Math.max(candidato.width || 0, candidato.height || 0);
    if (ladoMayor > 0) {
        if (ladoMayor >= 1000) {
            score += PESOS.dimensionGrande;
            razones.push("buena resolución (+" + PESOS.dimensionGrande + ")");
        } else if (ladoMayor >= 600) {
            score += PESOS.dimensionAceptable;
            razones.push("resolución aceptable (+" + PESOS.dimensionAceptable + ")");
        } else if (ladoMayor < 200) {
            score += PESOS.dimensionMuyChica;
            razones.push("imagen muy pequeña (" + PESOS.dimensionMuyChica + ")");
        }

        if (candidato.width && candidato.height) {
            const ratio = candidato.width / candidato.height;
            if (ratio >= 0.35 && ratio <= 1.2) {
                score += PESOS.aspectRatioProducto;
                razones.push("proporción típica de producto (+" + PESOS.aspectRatioProducto + ")");
            }
        }
    }

    // --- Dominio de la fuente ---
    if (dominio) {
        if (coincideDominio(dominio, DOMINIOS_CONFIABLES)) {
            score += PESOS.fuenteConfiable;
            razones.push("fuente confiable: " + dominio + " (+" + PESOS.fuenteConfiable + ")");
        } else if (coincideDominio(dominio, DOMINIOS_PENALIZADOS)) {
            score += PESOS.fuentePenalizada;
            razones.push("fuente de banco de imágenes/red social: " + dominio + " (" + PESOS.fuentePenalizada + ")");
        }
    }

    // --- Palabras que sugieren que la foto no es del producto en sí ---
    // No se rechaza solo por una palabra aislada (§19): son penalizaciones
    // que se acumulan, no descalificaciones automáticas.
    Object.keys(PALABRAS_PENALIZADAS).forEach((palabra) => {
        if (textoCandidato.indexOf(palabra) !== -1) {
            score += PALABRAS_PENALIZADAS[palabra];
            razones.push('menciona "' + palabra + '" (' + PALABRAS_PENALIZADAS[palabra] + ")");
        }
    });

    score = Math.max(0, Math.min(100, score));

    return { score: score, razones: razones, dominio: dominio };
}

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
                confianza: confianzaDeScore(resultado.score),
                razones: resultado.razones,
                sourceDomain: resultado.dominio
            });
        })
        .sort((a, b) => b.score - a.score);
}

module.exports = { calcularScore, confianzaDeScore, evaluarCandidatos, extraerDominio, PESOS };
