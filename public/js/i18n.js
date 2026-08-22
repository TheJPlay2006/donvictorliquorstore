/* ==========================
   IDIOMA (ES/EN)
   Motor de traducción liviano basado en atributos data-i18n.
   Traduce el texto visible del sitio; los datos que vienen de la
   base de datos (nombres, descripciones y marcas de productos) se
   muestran siempre tal como están cargados, en español.
========================== */

const DV_IDIOMA_CLAVE_ALMACENAMIENTO = "dv_idioma";
const DV_IDIOMA_POR_DEFECTO = "es";

const DV_DICCIONARIO = {
    es: {
        nav: {
            inicio: "Inicio",
            catalogo: "Catálogo",
            categorias: "Categorías",
            nosotros: "Nosotros",
            contacto: "Contacto",
            menuTitulo: "Menú",
            cerrarMenu: "Cerrar menú",
            abrirMenu: "Abrir menú",
            navegacionPrincipal: "Navegación principal",
            buscarProductos: "Buscar productos",
            logoInicio: "Licores Don Víctor, inicio",
        },
        idioma: {
            cambiarAIngles: "Cambiar a inglés",
            cambiarAEspanol: "Switch to Spanish",
            etiquetaEs: "Español",
            etiquetaEn: "Inglés",
        },
        anuncio: {
            texto: "Pedí tu licor favorito y coordiná la entrega directo por WhatsApp — respuesta rápida, todos los días.",
            boton: "Escribir ahora",
            cerrarAria: "Cerrar anuncio",
        },
        cookies: {
            aviso: "Usamos almacenamiento local del navegador para recordar tu idioma y mejorar tu experiencia.",
            masInfo: "Más información",
            aceptar: "Aceptar",
        },
        footer: {
            descripcion: "Licorera especializada en La Fortuna de San Carlos. Bebidas, cristalería y productos para coctelería.",
            navegacion: "Navegación",
            categoriasTitulo: "Categorías",
            catCervezas: "Cervezas",
            catVinos: "Vinos y espumantes",
            catWhisky: "Whisky y bourbon",
            catRon: "Ron",
            catVodka: "Vodka",
            catTequila: "Tequila y mezcal",
            catGinebra: "Ginebra",
            contactoTitulo: "Contacto",
            direccion: "La Fortuna de San Carlos, Alajuela, Costa Rica",
            horario: "Lun–Sáb: 9 a. m.–9 p. m. · Dom: 10 a. m.–7 p. m.",
            whatsappDirecto: "WhatsApp directo",
            avisoEdad: "🔞 Venta exclusiva a mayores de 18 años. Consumo responsable. Prohibida la venta a menores de edad.",
            avisoPrecios: "La disponibilidad y los precios pueden cambiar.",
            disclaimer: "Aviso legal",
            terminos: "Términos de uso",
            privacidad: "Política de privacidad",
            cookies: "Cookies",
            creditoPrefijo: "Sitio web y marca por",
        },
        common: {
            inicio: "Inicio",
            verCatalogo: "Ver catálogo",
            contactarnos: "Contactarnos",
            escribinos: "Escribinos",
            consultar: "Consultar",
            whatsappFlotanteAria: "Escribir a Licores Don Víctor por WhatsApp",
        },
        inicio: {
            metaTitulo: "Inicio | Licores Don Víctor",
            heroTitulo: "La bebida correcta para cada ocasión",
            heroTexto: "Licores nacionales e importados, cervezas, vinos, cristalería y artículos para coctelería con atención directa y cercana.",
            datoProductos: "productos",
            datoAtencionFuerte: "Atención",
            datoAtencionTexto: " por WhatsApp",
            datoHorarioFuerte: "Lun–Sáb",
            datoHorarioTexto: " 9 a. m.–9 p. m.",
            visualPequeno: "Comprá con confianza",
            visualFuerte: "Precio y disponibilidad reales",
            categoriasEtiqueta: "Explorá",
            categoriasTitulo: "Categorías destacadas",
            categoriasTexto: "Explorá por tipo de bebida o producto",
            verTodasCategorias: "Ver todas las categorías",
            productosTitulo: "Productos destacados",
            productosTexto: "Selección de nuestros productos más populares",
            verTodos: "Ver todos",
            cotizacionTitulo: "¿Necesitás productos en cantidad?",
            cotizacionTexto: "Atendemos consultas de empresas, eventos, comercios y clientes que requieren cantidades especiales. Contactanos para coordinar una cotización personalizada.",
            solicitarCotizacion: "Solicitar cotización",
            beneficiosTitulo: "¿Por qué elegirnos?",
            beneficio1Titulo: "Gran variedad",
            beneficio1Texto: "Más de 200 productos entre bebidas, cristalería y accesorios para coctelería.",
            beneficio2Titulo: "Precios claros",
            beneficio2Texto: "Precios en colones costarricenses, fáciles de consultar sin sorpresas.",
            beneficio3Titulo: "Respuesta rápida",
            beneficio3Texto: "Atención directa por WhatsApp. Te respondemos a la brevedad.",
            beneficio4Titulo: "Clientes y empresas",
            beneficio4Texto: "Servicio para particulares, eventos, restaurantes y comercios.",
            redesTitulo: "Seguinos en redes sociales",
            redesTexto: "Conocé novedades, promociones y más en nuestras redes.",
            ubicacionEtiqueta: "Visitanos",
            ubicacionTitulo: "Ubicación y contacto",
            ubicacionTexto: "Estamos disponibles para atender consultas sobre productos, precios, disponibilidad y pedidos especiales.",
            direccionLabel: "Dirección",
            direccionTexto: "Del Banco de Costa Rica 100 metros sur y 100 oeste, La Fortuna, Costa Rica",
            horarioLabel: "Horario",
            horarioTextoHtml: "Lunes a sábado: 9:00 a. m. – 9:00 p. m.<br>Domingo: 10:00 a. m. – 7:00 p. m.",
            telefonoLabel: "Teléfono",
            comoLlegar: "Cómo llegar",
            duenoBadgePeq: "Desde el primer día",
            duenoBadgeFuerte: "Al frente del negocio",
            duenoEtiqueta: "Conocé al dueño",
            duenoTitulo: "Conocé a Don Víctor",
            duenoTexto: "Don Víctor abrió las puertas de la licorera con una idea simple: atender a cada cliente como si fuera de la familia. Hoy sigue al frente del negocio, asegurándose de que cada pedido salga con la misma atención de siempre.",
            duenoCita: "“Cada botella que sale de acá lleva mi nombre — por eso la atención siempre es personal.”",
            duenoCitaAutor: "— Don Víctor, dueño",
            duenoBoton: "Escribile por WhatsApp",
        },
        nosotros: {
            metaTitulo: "Sobre nosotros | Licores Don Víctor",
            breadcrumb: "Nosotros",
            etiquetaHistoria: "Nuestra historia",
            heroTitulo: "Bebidas, cristalería y coctelería en el corazón de La Fortuna",
            heroTexto: "Somos una licorera especializada con una amplia selección de bebidas nacionales e importadas, cristalería y artículos para coctelería. Atendemos tanto a clientes particulares como a empresas, eventos y comercios.",
            etiquetaDonde: "Dónde estamos",
            historiaTitulo: "Un local pensado para vos, en La Fortuna",
            historiaTexto1: "Nuestro local está en La Fortuna de San Carlos, un punto de referencia para quienes buscan bebidas nacionales e importadas, cristalería y artículos para coctelería en la zona.",
            historiaTexto2: "Trabajamos con atención directa y personalizada: cada consulta se responde de verdad, para ayudarte a encontrar la bebida correcta para cada ocasión.",
            etiquetaProposito: "Para qué existimos",
            propositoTitulo: "Lo que te ofrece Licores Don Víctor",
            prop1Titulo: "Variedad real",
            prop1Texto: "Más de 200 productos entre licores, cervezas, vinos, cristalería y artículos para coctelería.",
            prop2Titulo: "Atención cercana",
            prop2Texto: "Hablás directo con alguien que te ayuda a decidir, no con un catálogo genérico.",
            prop3Titulo: "Consultá por WhatsApp",
            prop3Texto: "Preguntá disponibilidad, precio o una presentación específica sin salir de la conversación.",
            prop4Titulo: "Catálogo digital de apoyo",
            prop4Texto: "Explorá el catálogo desde el celular antes de escribirnos, para llegar con la idea clara.",
            etiquetaTrabajamos: "Cómo trabajamos",
            valoresTitulo: "Nuestros valores",
            valor1Titulo: "Atención cercana",
            valor1Texto: "Trato personalizado para cada cliente, particular o empresa.",
            valor2Titulo: "Variedad",
            valor2Texto: "Más de 200 productos seleccionados de las mejores marcas.",
            valor3Titulo: "Confianza",
            valor3Texto: "Precios claros y disponibilidad real, sin sorpresas.",
            valor4Titulo: "Experiencia local",
            valor4Texto: "Conocemos la zona, los productos y lo que buscan los clientes de La Fortuna.",
            etiquetaComprar: "Cómo comprar",
            experienciaTitulo: "Tu recorrido con nosotros",
            paso1Titulo: "Explorás el catálogo",
            paso1Texto: "Mirá productos, precios y disponibilidad desde el catálogo digital.",
            paso2Titulo: "Revisás la información",
            paso2Texto: "Marca, presentación y categoría, todo claro antes de escribir.",
            paso3Titulo: "Consultás por WhatsApp",
            paso3Texto: "Escribinos con el producto que te interesa, directo desde la web.",
            paso4Titulo: "Recibís atención directa",
            paso4Texto: "Te confirmamos disponibilidad y coordinamos tu compra.",
            ctaTitulo: "¿Buscás algo para una ocasión especial?",
            ctaTexto: "Explorá el catálogo completo o escribinos directo y te ayudamos a encontrarlo.",
        },
        contacto: {
            metaTitulo: "Contacto | Licores Don Víctor",
            breadcrumb: "Contacto",
            etiqueta: "Estamos para ayudarte",
            heroTitulo: "Resolvemos tu consulta en minutos",
            heroTexto: "Escribinos por WhatsApp, llamanos o dejanos tu mensaje. Te respondemos con disponibilidad y precios reales.",
            accesoWhatsappPeq: "Respuesta rápida",
            accesoVisitanosPeq: "Visitanos",
            accesoHorarioPeq: "Horario",
            accesoHorarioTexto: "Lun–Sáb 9 a. m.–9 p. m. · Dom 10 a. m.–7 p. m.",
            canalesEtiqueta: "Canales directos",
            canalesTitulo: "Elegí cómo contactarnos",
            canalTelefonoPeq: "Teléfono",
            canalTelefonoAccion: "Llamar ahora",
            canalWhatsappAccion: "Escribir por WhatsApp",
            canalFacebookAccion: "Ver página",
            canalInstagramAccion: "Ver perfil",
            formularioTitulo: "Envianos tu consulta",
            formularioTexto: "Completá el formulario y tu mensaje se abre directo en WhatsApp, listo para enviar.",
            labelNombre: "Nombre",
            placeholderNombre: "Tu nombre completo",
            labelTelefono: "Teléfono",
            placeholderTelefono: "Tu número de teléfono",
            labelMensaje: "Mensaje",
            placeholderMensaje: "¿En qué te podemos ayudar? Consultá por un producto, cotización, disponibilidad, etc.",
            botonEnviar: "Enviar consulta por WhatsApp",
            nota: "Al enviar, se abrirá WhatsApp con tu mensaje listo para enviar.",
            infoTitulo: "Horario y ubicación",
            horarioFuerte: "Horario de atención",
            horarioTextoHtml: "Lunes a sábado: 9:00 a. m. – 9:00 p. m.<br>Domingo: 10:00 a. m. – 7:00 p. m.",
            direccionFuerte: "Dirección",
            direccionTextoHtml: "Del Banco de Costa Rica 100 metros sur y 100 oeste,<br>La Fortuna, Costa Rica",
            abrirMaps: "Abrir en Google Maps",
            faqEtiqueta: "Preguntas frecuentes",
            faqTitulo: "Antes de escribirnos",
            faq1P: "¿Puedo consultar disponibilidad por WhatsApp?",
            faq1R: "Sí. Escribinos con el nombre del producto y te confirmamos si está disponible.",
            faq2P: "¿Los precios pueden cambiar?",
            faq2R: "Sí, los precios y la disponibilidad pueden variar. Te confirmamos el precio vigente al momento de tu consulta.",
            faq3P: "¿Puedo consultar por una presentación específica?",
            faq3R: "Sí, contanos la presentación o el tamaño que buscás y te decimos si la tenemos.",
            faq4P: "¿Cómo puedo conocer las promociones?",
            faq4R: "Los productos en promoción se identifican en el catálogo digital; también podés preguntarnos directamente por WhatsApp.",
            ctaTitulo: "¿Tenés una consulta rápida?",
            ctaTexto: "Escribinos directo por WhatsApp, sin formularios.",
            ctaBoton: "Iniciar conversación",
        },
        categorias: {
            metaTitulo: "Categorías | Licores Don Víctor",
            breadcrumb: "Categorías",
            titulo: "Todas las categorías",
            subtitulo: "Explorá nuestra variedad por tipo de producto",
        },
        catalogo: {
            metaTitulo: "Catálogo | Licores Don Víctor",
            breadcrumb: "Catálogo",
            titulo: "Catálogo de productos",
            subtitulo: "Explorá nuestra selección completa de bebidas y accesorios",
            buscarPlaceholder: "Buscar por nombre, marca o código",
            filtrosBoton: "Filtros",
            filtrosTitulo: "Filtros",
            categoriaTitulo: "Categoría",
            todasCategorias: "Todas las categorías",
            disponibilidadTitulo: "Disponibilidad",
            dispTodas: "Todas",
            dispDisponibles: "Disponibles",
            dispAgotado: "Agotado",
            dispConsultar: "Consultar",
            verProductos: "Ver productos",
            ordenNombreAsc: "Nombre: A-Z",
            ordenNombreDesc: "Nombre: Z-A",
            ordenPrecioAsc: "Precio: menor a mayor",
            ordenPrecioDesc: "Precio: mayor a menor",
            vistaCuadricula: "Vista en cuadrícula",
            vistaLista: "Vista en lista",
            cargarMasBoton: "Cargar más productos",
            cerrarFiltrosAria: "Cerrar filtros",
            whatsappFlotanteAria: "Consultar por WhatsApp",
            modalDetalleTitulo: "Detalle del producto",
            modalCerrarAria: "Cerrar",
            modalPlaceholder: "Aquí aparecerá la información del producto.",
        },
        producto: {
            promocion: "Promoción",
            destacado: "Destacado",
            disponible: "Disponible",
            agotado: "Agotado",
            consultar: "Consultar",
            verDetalle: "Ver detalle",
            sinMarca: "Sin marca",
            presentacionConsultar: "Presentación por consultar",
            descripcionNoDisponible: "Descripción no disponible.",
            consultarWhatsApp: "Consultar por WhatsApp",
            cerrar: "Cerrar",
            consultarAriaPrefijo: "Consultar",
            consultarAriaSufijo: "por WhatsApp",
            verProductos: "Ver productos",
            cargandoCategorias: "Cargando categorías...",
            errorCategorias: "No fue posible cargar las categorías.",
            sinCategorias: "No hay categorías disponibles.",
            cargandoProductos: "Cargando productos...",
            cargandoProductosDestacados: "Cargando productos destacados...",
            errorProductosDestacados: "No fue posible cargar los productos destacados.",
            sinProductosDestacados: "No hay productos destacados disponibles.",
            sinProductosCategoria: "No hay productos disponibles en esta categoría.",
            descripcionCategoriaGenerica: "Productos disponibles en esta categoría.",
            explorarProductosCategoria: "Explorá los productos de esta categoria",
            unProducto: "1 producto",
            nProductos: "{n} productos",
            errorCatalogo: "Ocurrió un error al cargar el catálogo.",
            errorCargarCatalogo: "No fue posible cargar los productos",
            sinResultados: "No se encontraron productos.",
            unEncontrado: "Se encontró 1 producto",
            nEncontrados: "Se encontraron {n} productos",
            cargarMasCorto: "Cargar más",
        },
        pagina404: {
            metaTitulo: "Página no encontrada | Licores Don Víctor",
            titulo: "¡Ups! Esta página se perdió como una botella sin etiqueta.",
            texto: "La página que buscás no existe o fue movida. Volvé al inicio o mirá nuestro catálogo completo.",
            botonInicio: "Volver al inicio",
        },
        legal: {
            metaTituloDisclaimer: "Aviso legal | Licores Don Víctor",
            metaTituloTerminos: "Términos de uso | Licores Don Víctor",
            metaTituloPrivacidad: "Política de privacidad | Licores Don Víctor",
            metaTituloCookies: "Política de cookies | Licores Don Víctor",
            breadcrumbDisclaimer: "Aviso legal",
            breadcrumbTerminos: "Términos de uso",
            breadcrumbPrivacidad: "Política de privacidad",
            breadcrumbCookies: "Política de cookies",
            cookiesTitulo: "Política de cookies",
            cookiesIntro: "Esta política explica qué información guarda este sitio en tu navegador y para qué la usamos.",
            cookiesS1Titulo: "¿Qué usamos?",
            cookiesS1Texto: "Este sitio no usa cookies de rastreo ni de publicidad de terceros. Usamos únicamente el almacenamiento local (localStorage) de tu propio navegador para recordar preferencias funcionales, como tu idioma elegido (español o inglés) o si ya cerraste un aviso en el sitio.",
            cookiesS2Titulo: "¿Por qué lo usamos?",
            cookiesS2Texto: "Esta información nos permite ofrecerte una experiencia más cómoda, por ejemplo mostrando el sitio en el idioma que ya elegiste sin tener que seleccionarlo de nuevo en cada visita.",
            cookiesS3Titulo: "¿Se comparte esta información?",
            cookiesS3Texto: "No. Esta información se guarda únicamente en tu navegador, en tu propio dispositivo. Nunca se envía a nuestros servidores ni se comparte con terceros.",
            cookiesS4Titulo: "¿Cómo la elimino?",
            cookiesS4Texto: "Podés borrar esta información en cualquier momento desde la configuración de privacidad de tu navegador (por ejemplo, borrando los datos de sitios web) o limpiando el almacenamiento local para este sitio.",
            cookiesS5Titulo: "Cambios en esta política",
            cookiesS5Texto: "Podemos actualizar esta política si cambiamos la forma en que usamos el almacenamiento local. Cualquier cambio se publicará en esta misma página.",
            actualizado: "Última actualización: agosto de 2026",
            disclaimerTitulo: "Aviso legal",
            disclaimerIntro: "Este aviso legal aplica al sitio web de Licores Don Víctor (Don Victor Liquor Store), operado en La Fortuna de San Carlos, Costa Rica.",
            disclaimerS1Titulo: "Venta a mayores de edad",
            disclaimerS1Texto: "Este sitio y los productos que ofrece están destinados exclusivamente a personas mayores de 18 años. Al usar este sitio, confirmás que cumplís con la edad mínima legal para la compra y consumo de bebidas alcohólicas en Costa Rica. Nos reservamos el derecho de solicitar identificación al momento de la entrega.",
            disclaimerS2Titulo: "Consumo responsable",
            disclaimerS2Texto: "Promovemos el consumo responsable de alcohol. Si consumís bebidas alcohólicas, hacelo con moderación y nunca conduzcas bajo sus efectos.",
            disclaimerS3Titulo: "Información del catálogo",
            disclaimerS3Texto: "Los precios, la disponibilidad y las presentaciones que se muestran en este sitio son referenciales y pueden cambiar sin previo aviso. Este sitio no procesa pagos ni ventas en línea: cada consulta y compra se coordina de forma directa por WhatsApp o en el local, donde se confirma el precio y la disponibilidad vigentes.",
            disclaimerS4Titulo: "Uso del contenido",
            disclaimerS4Texto: "El contenido de este sitio (textos, imágenes, marca y diseño) es propiedad de Licores Don Víctor o se usa con la autorización correspondiente, y no puede reproducirse sin permiso.",
            disclaimerS5Titulo: "Enlaces externos",
            disclaimerS5Texto: "Este sitio puede incluir enlaces a redes sociales o servicios de terceros (como WhatsApp, Facebook, Instagram o Google Maps). No somos responsables por el contenido o las políticas de esos sitios externos.",
            terminosTitulo: "Términos de uso",
            terminosIntro: "Al navegar y usar el sitio web de Licores Don Víctor, aceptás los siguientes términos de uso.",
            terminosS1Titulo: "Objeto del sitio",
            terminosS1Texto: "Este sitio funciona como catálogo digital informativo. No es una tienda en línea: no se procesan pagos ni transacciones a través del sitio. Cada consulta o pedido se coordina directamente con nuestro equipo por WhatsApp, teléfono o en el local.",
            terminosS2Titulo: "Uso permitido",
            terminosS2Texto: "Podés consultar el catálogo, buscar productos y contactarnos con fines personales y legítimos. No está permitido usar el sitio para fines fraudulentos, ilegales o que afecten su funcionamiento normal.",
            terminosS3Titulo: "Disponibilidad y precios",
            terminosS3Texto: "La información de productos, precios y disponibilidad se actualiza periódicamente, pero puede no reflejar el estado exacto en tiempo real. El precio y la disponibilidad final se confirman siempre al momento de tu consulta.",
            terminosS4Titulo: "Propiedad intelectual",
            terminosS4Texto: "La marca, el logotipo, los textos, las imágenes y el diseño de este sitio pertenecen a Licores Don Víctor, salvo que se indique lo contrario, y no pueden copiarse ni reutilizarse sin autorización.",
            terminosS5Titulo: "Cambios en estos términos",
            terminosS5Texto: "Podemos actualizar estos términos en cualquier momento para reflejar cambios en el sitio o en nuestros servicios. La versión vigente siempre estará disponible en esta página.",
            terminosS6Titulo: "Contacto",
            terminosS6Texto: "Si tenés dudas sobre estos términos, podés escribirnos por WhatsApp o desde la página de contacto.",
            privacidadTitulo: "Política de privacidad",
            privacidadIntro: "En Licores Don Víctor respetamos tu privacidad. Esta política explica qué información recopilamos a través del sitio y cómo la usamos.",
            privacidadS1Titulo: "Información que recopilamos",
            privacidadS1Texto: "Cuando usás el formulario de contacto, recopilamos los datos que ingresás voluntariamente: nombre, número de teléfono y el mensaje de tu consulta. No pedimos datos de tarjetas ni procesamos pagos en el sitio.",
            privacidadS2Titulo: "Cómo usamos tu información",
            privacidadS2Texto: "Usamos estos datos únicamente para responder tu consulta, coordinar disponibilidad y, si aplica, gestionar la venta directamente por WhatsApp o en el local. No vendemos ni compartimos tu información con terceros para fines comerciales ajenos a nuestro negocio.",
            privacidadS3Titulo: "WhatsApp y redes sociales",
            privacidadS3Texto: "Cuando nos escribís por WhatsApp, Facebook o Instagram, tu conversación queda sujeta también a las políticas de privacidad de esas plataformas, además de esta política.",
            privacidadS4Titulo: "Cookies y navegación",
            privacidadS4Texto: "Este sitio puede usar almacenamiento local del navegador (por ejemplo, para recordar tu idioma preferido) con fines puramente funcionales. No usamos esta información para rastrearte en otros sitios.",
            privacidadS5Titulo: "Tus derechos",
            privacidadS5Texto: "Podés solicitarnos en cualquier momento que actualicemos o eliminemos los datos personales que nos hayas compartido, escribiéndonos por WhatsApp o desde la página de contacto.",
            privacidadS6Titulo: "Cambios en esta política",
            privacidadS6Texto: "Podemos actualizar esta política ocasionalmente. Cualquier cambio se publicará en esta misma página.",
        },
    },
    en: {
        nav: {
            inicio: "Home",
            catalogo: "Catalog",
            categorias: "Categories",
            nosotros: "About",
            contacto: "Contact",
            menuTitulo: "Menu",
            cerrarMenu: "Close menu",
            abrirMenu: "Open menu",
            navegacionPrincipal: "Main navigation",
            buscarProductos: "Search products",
            logoInicio: "Licores Don Víctor, home",
        },
        idioma: {
            cambiarAIngles: "Switch to English",
            cambiarAEspanol: "Cambiar a español",
            etiquetaEs: "Spanish",
            etiquetaEn: "English",
        },
        anuncio: {
            texto: "Order your favorite drink and arrange delivery straight through WhatsApp — fast replies, every day.",
            boton: "Message us now",
            cerrarAria: "Close announcement",
        },
        cookies: {
            aviso: "We use your browser's local storage to remember your language and improve your experience.",
            masInfo: "Learn more",
            aceptar: "Accept",
        },
        footer: {
            descripcion: "Specialty liquor store in La Fortuna de San Carlos. Beverages, glassware, and cocktail supplies.",
            navegacion: "Navigation",
            categoriasTitulo: "Categories",
            catCervezas: "Beers",
            catVinos: "Wines & sparkling",
            catWhisky: "Whisky & bourbon",
            catRon: "Rum",
            catVodka: "Vodka",
            catTequila: "Tequila & mezcal",
            catGinebra: "Gin",
            contactoTitulo: "Contact",
            direccion: "La Fortuna de San Carlos, Alajuela, Costa Rica",
            horario: "Mon–Sat: 9 a.m.–9 p.m. · Sun: 10 a.m.–7 p.m.",
            whatsappDirecto: "Direct WhatsApp",
            avisoEdad: "🔞 Sale exclusively to adults 18+. Please drink responsibly. Sale to minors is prohibited.",
            avisoPrecios: "Availability and prices may change.",
            disclaimer: "Disclaimer",
            terminos: "Terms of Use",
            privacidad: "Privacy Policy",
            cookies: "Cookies",
            creditoPrefijo: "Website & branding by",
        },
        common: {
            inicio: "Home",
            verCatalogo: "View catalog",
            contactarnos: "Contact us",
            escribinos: "Message us",
            consultar: "Inquire",
            whatsappFlotanteAria: "Message Licores Don Víctor on WhatsApp",
        },
        inicio: {
            metaTitulo: "Home | Licores Don Víctor",
            heroTitulo: "The right drink for every occasion",
            heroTexto: "Local and imported spirits, beers, wines, glassware, and cocktail supplies — with direct, personal service.",
            datoProductos: "products",
            datoAtencionFuerte: "Support",
            datoAtencionTexto: " via WhatsApp",
            datoHorarioFuerte: "Mon–Sat",
            datoHorarioTexto: " 9 a.m.–9 p.m.",
            visualPequeno: "Shop with confidence",
            visualFuerte: "Real prices & availability",
            categoriasEtiqueta: "Explore",
            categoriasTitulo: "Featured categories",
            categoriasTexto: "Browse by drink or product type",
            verTodasCategorias: "View all categories",
            productosTitulo: "Featured products",
            productosTexto: "A selection of our most popular products",
            verTodos: "View all",
            cotizacionTitulo: "Need products in bulk?",
            cotizacionTexto: "We handle requests from businesses, events, shops, and customers who need special quantities. Contact us to arrange a custom quote.",
            solicitarCotizacion: "Request a quote",
            beneficiosTitulo: "Why choose us?",
            beneficio1Titulo: "Wide variety",
            beneficio1Texto: "Over 200 products across beverages, glassware, and cocktail accessories.",
            beneficio2Titulo: "Clear pricing",
            beneficio2Texto: "Prices in Costa Rican colones — easy to check, no surprises.",
            beneficio3Titulo: "Fast response",
            beneficio3Texto: "Direct WhatsApp support. We reply as soon as we can.",
            beneficio4Titulo: "Customers & businesses",
            beneficio4Texto: "Service for individuals, events, restaurants, and shops.",
            redesTitulo: "Follow us on social media",
            redesTexto: "Check out news, promotions, and more on our social channels.",
            ubicacionEtiqueta: "Visit us",
            ubicacionTitulo: "Location & contact",
            ubicacionTexto: "We're available to help with questions about products, prices, availability, and special orders.",
            direccionLabel: "Address",
            direccionTexto: "100 meters south and 100 west of Banco de Costa Rica, La Fortuna, Costa Rica",
            horarioLabel: "Hours",
            horarioTextoHtml: "Monday to Saturday: 9:00 a.m. – 9:00 p.m.<br>Sunday: 10:00 a.m. – 7:00 p.m.",
            telefonoLabel: "Phone",
            comoLlegar: "Get directions",
            duenoBadgePeq: "Since day one",
            duenoBadgeFuerte: "Still behind the counter",
            duenoEtiqueta: "Meet the owner",
            duenoTitulo: "Meet Don Víctor",
            duenoTexto: "Don Víctor opened the store with a simple idea: treat every customer like family. Today he's still behind the counter, making sure every order gets the same personal attention it always has.",
            duenoCita: "“Every bottle that leaves here carries my name — that's why the service is always personal.”",
            duenoCitaAutor: "— Don Víctor, owner",
            duenoBoton: "Message him on WhatsApp",
        },
        nosotros: {
            metaTitulo: "About us | Licores Don Víctor",
            breadcrumb: "About",
            etiquetaHistoria: "Our story",
            heroTitulo: "Spirits, glassware, and cocktail supplies in the heart of La Fortuna",
            heroTexto: "We're a specialty liquor store with a wide selection of local and imported beverages, glassware, and cocktail supplies. We serve individual customers as well as businesses, events, and shops.",
            etiquetaDonde: "Where we are",
            historiaTitulo: "A store built for you, in La Fortuna",
            historiaTexto1: "Our store is located in La Fortuna de San Carlos, a go-to spot for anyone in the area looking for local and imported beverages, glassware, and cocktail supplies.",
            historiaTexto2: "We offer direct, personal service — every question gets a real answer, so we can help you find the right drink for every occasion.",
            etiquetaProposito: "Our purpose",
            propositoTitulo: "What Licores Don Víctor offers you",
            prop1Titulo: "Real variety",
            prop1Texto: "Over 200 products across spirits, beers, wines, glassware, and cocktail supplies.",
            prop2Titulo: "Personal service",
            prop2Texto: "You talk directly with someone who helps you decide — not a generic catalog.",
            prop3Titulo: "Ask us on WhatsApp",
            prop3Texto: "Ask about availability, price, or a specific size without leaving the chat.",
            prop4Titulo: "A digital catalog to help",
            prop4Texto: "Browse the catalog on your phone before reaching out, so you know exactly what you want.",
            etiquetaTrabajamos: "How we work",
            valoresTitulo: "Our values",
            valor1Titulo: "Personal service",
            valor1Texto: "Personalized service for every customer, individual or business.",
            valor2Titulo: "Variety",
            valor2Texto: "Over 200 products selected from the best brands.",
            valor3Titulo: "Trust",
            valor3Texto: "Clear prices and real availability, no surprises.",
            valor4Titulo: "Local expertise",
            valor4Texto: "We know the area, the products, and what La Fortuna customers are looking for.",
            etiquetaComprar: "How to shop",
            experienciaTitulo: "Your journey with us",
            paso1Titulo: "Browse the catalog",
            paso1Texto: "Check products, prices, and availability in the digital catalog.",
            paso2Titulo: "Review the details",
            paso2Texto: "Brand, size, and category — all clear before you reach out.",
            paso3Titulo: "Ask on WhatsApp",
            paso3Texto: "Message us about the product you're interested in, right from the site.",
            paso4Titulo: "Get direct service",
            paso4Texto: "We confirm availability and set up your purchase.",
            ctaTitulo: "Looking for something for a special occasion?",
            ctaTexto: "Browse the full catalog or message us directly and we'll help you find it.",
        },
        contacto: {
            metaTitulo: "Contact | Licores Don Víctor",
            breadcrumb: "Contact",
            etiqueta: "We're here to help",
            heroTitulo: "We'll answer your question in minutes",
            heroTexto: "Message us on WhatsApp, call us, or leave your message. We'll reply with real availability and prices.",
            accesoWhatsappPeq: "Fast reply",
            accesoVisitanosPeq: "Visit us",
            accesoHorarioPeq: "Hours",
            accesoHorarioTexto: "Mon–Sat 9 a.m.–9 p.m. · Sun 10 a.m.–7 p.m.",
            canalesEtiqueta: "Direct channels",
            canalesTitulo: "Choose how to reach us",
            canalTelefonoPeq: "Phone",
            canalTelefonoAccion: "Call now",
            canalWhatsappAccion: "Message on WhatsApp",
            canalFacebookAccion: "View page",
            canalInstagramAccion: "View profile",
            formularioTitulo: "Send us your question",
            formularioTexto: "Fill out the form and your message opens directly in WhatsApp, ready to send.",
            labelNombre: "Name",
            placeholderNombre: "Your full name",
            labelTelefono: "Phone",
            placeholderTelefono: "Your phone number",
            labelMensaje: "Message",
            placeholderMensaje: "How can we help? Ask about a product, a quote, availability, etc.",
            botonEnviar: "Send question via WhatsApp",
            nota: "When you submit, WhatsApp will open with your message ready to send.",
            infoTitulo: "Hours & location",
            horarioFuerte: "Business hours",
            horarioTextoHtml: "Monday to Saturday: 9:00 a.m. – 9:00 p.m.<br>Sunday: 10:00 a.m. – 7:00 p.m.",
            direccionFuerte: "Address",
            direccionTextoHtml: "100 meters south and 100 west of Banco de Costa Rica,<br>La Fortuna, Costa Rica",
            abrirMaps: "Open in Google Maps",
            faqEtiqueta: "Frequently asked questions",
            faqTitulo: "Before you reach out",
            faq1P: "Can I check availability on WhatsApp?",
            faq1R: "Yes. Message us with the product name and we'll confirm if it's in stock.",
            faq2P: "Can prices change?",
            faq2R: "Yes, prices and availability can vary. We'll confirm the current price when you ask.",
            faq3P: "Can I ask about a specific size?",
            faq3R: "Yes, tell us the size you're looking for and we'll let you know if we have it.",
            faq4P: "How can I find out about promotions?",
            faq4R: "Promotional products are marked in the digital catalog; you can also ask us directly on WhatsApp.",
            ctaTitulo: "Have a quick question?",
            ctaTexto: "Message us directly on WhatsApp, no forms needed.",
            ctaBoton: "Start a conversation",
        },
        categorias: {
            metaTitulo: "Categories | Licores Don Víctor",
            breadcrumb: "Categories",
            titulo: "All categories",
            subtitulo: "Browse our range by product type",
        },
        catalogo: {
            metaTitulo: "Catalog | Licores Don Víctor",
            breadcrumb: "Catalog",
            titulo: "Product catalog",
            subtitulo: "Browse our full selection of beverages and accessories",
            buscarPlaceholder: "Search by name, brand, or code",
            filtrosBoton: "Filters",
            filtrosTitulo: "Filters",
            categoriaTitulo: "Category",
            todasCategorias: "All categories",
            disponibilidadTitulo: "Availability",
            dispTodas: "All",
            dispDisponibles: "In stock",
            dispAgotado: "Out of stock",
            dispConsultar: "Inquire",
            verProductos: "Show products",
            ordenNombreAsc: "Name: A-Z",
            ordenNombreDesc: "Name: Z-A",
            ordenPrecioAsc: "Price: low to high",
            ordenPrecioDesc: "Price: high to low",
            vistaCuadricula: "Grid view",
            vistaLista: "List view",
            cargarMasBoton: "Load more products",
            cerrarFiltrosAria: "Close filters",
            whatsappFlotanteAria: "Ask on WhatsApp",
            modalDetalleTitulo: "Product details",
            modalCerrarAria: "Close",
            modalPlaceholder: "Product information will appear here.",
        },
        producto: {
            promocion: "Promotion",
            destacado: "Featured",
            disponible: "In stock",
            agotado: "Out of stock",
            consultar: "Inquire",
            verDetalle: "View details",
            sinMarca: "No brand",
            presentacionConsultar: "Size on request",
            descripcionNoDisponible: "Description not available.",
            consultarWhatsApp: "Ask on WhatsApp",
            cerrar: "Close",
            consultarAriaPrefijo: "Ask about",
            consultarAriaSufijo: "on WhatsApp",
            verProductos: "View products",
            cargandoCategorias: "Loading categories...",
            errorCategorias: "We couldn't load the categories.",
            sinCategorias: "No categories available.",
            cargandoProductos: "Loading products...",
            cargandoProductosDestacados: "Loading featured products...",
            errorProductosDestacados: "We couldn't load the featured products.",
            sinProductosDestacados: "No featured products available.",
            sinProductosCategoria: "No products available in this category.",
            descripcionCategoriaGenerica: "Products available in this category.",
            explorarProductosCategoria: "Browse products in this category",
            unProducto: "1 product",
            nProductos: "{n} products",
            errorCatalogo: "There was an error loading the catalog.",
            errorCargarCatalogo: "We couldn't load the products",
            sinResultados: "No products found.",
            unEncontrado: "Found 1 product",
            nEncontrados: "Found {n} products",
            cargarMasCorto: "Load more",
        },
        pagina404: {
            metaTitulo: "Page not found | Licores Don Víctor",
            titulo: "Oops! This page wandered off like an unlabeled bottle.",
            texto: "The page you're looking for doesn't exist or was moved. Head back home or browse our full catalog.",
            botonInicio: "Back to home",
        },
        legal: {
            metaTituloDisclaimer: "Disclaimer | Licores Don Víctor",
            metaTituloTerminos: "Terms of Use | Licores Don Víctor",
            metaTituloPrivacidad: "Privacy Policy | Licores Don Víctor",
            metaTituloCookies: "Cookie Policy | Licores Don Víctor",
            breadcrumbDisclaimer: "Disclaimer",
            breadcrumbTerminos: "Terms of Use",
            breadcrumbPrivacidad: "Privacy Policy",
            breadcrumbCookies: "Cookie Policy",
            cookiesTitulo: "Cookie Policy",
            cookiesIntro: "This policy explains what information this site stores in your browser and what we use it for.",
            cookiesS1Titulo: "What do we use?",
            cookiesS1Texto: "This site doesn't use tracking or third-party advertising cookies. We only use your own browser's local storage (localStorage) to remember functional preferences, like your chosen language (Spanish or English) or whether you've already closed a notice on the site.",
            cookiesS2Titulo: "Why do we use it?",
            cookiesS2Texto: "This information lets us offer you a more comfortable experience — for example, showing the site in the language you already picked without asking again on every visit.",
            cookiesS3Titulo: "Is this information shared?",
            cookiesS3Texto: "No. This information is stored only in your browser, on your own device. It's never sent to our servers or shared with third parties.",
            cookiesS4Titulo: "How do I delete it?",
            cookiesS4Texto: "You can delete this information at any time from your browser's privacy settings (for example, by clearing site data) or by clearing local storage for this site.",
            cookiesS5Titulo: "Changes to this policy",
            cookiesS5Texto: "We may update this policy if we change how we use local storage. Any changes will be posted on this same page.",
            actualizado: "Last updated: August 2026",
            disclaimerTitulo: "Disclaimer",
            disclaimerIntro: "This disclaimer applies to the Licores Don Víctor (Don Victor Liquor Store) website, operated in La Fortuna de San Carlos, Costa Rica.",
            disclaimerS1Titulo: "Sale to adults only",
            disclaimerS1Texto: "This site and the products it lists are intended exclusively for people 18 years of age or older. By using this site, you confirm that you meet the legal minimum age to purchase and consume alcoholic beverages in Costa Rica. We reserve the right to request identification at the time of delivery.",
            disclaimerS2Titulo: "Drink responsibly",
            disclaimerS2Texto: "We promote responsible alcohol consumption. If you drink, do so in moderation and never drive under its effects.",
            disclaimerS3Titulo: "Catalog information",
            disclaimerS3Texto: "Prices, availability, and package sizes shown on this site are for reference and may change without notice. This site does not process payments or online sales: every inquiry and purchase is coordinated directly via WhatsApp or in person at the store, where the current price and availability are confirmed.",
            disclaimerS4Titulo: "Use of content",
            disclaimerS4Texto: "The content on this site (text, images, branding, and design) belongs to Licores Don Víctor or is used with proper authorization, and may not be reproduced without permission.",
            disclaimerS5Titulo: "External links",
            disclaimerS5Texto: "This site may include links to social media or third-party services (such as WhatsApp, Facebook, Instagram, or Google Maps). We are not responsible for the content or policies of those external sites.",
            terminosTitulo: "Terms of Use",
            terminosIntro: "By browsing and using the Licores Don Víctor website, you agree to the following terms of use.",
            terminosS1Titulo: "Purpose of the site",
            terminosS1Texto: "This site works as an informational digital catalog. It is not an online store: no payments or transactions are processed through the site. Every inquiry or order is coordinated directly with our team via WhatsApp, phone, or in person at the store.",
            terminosS2Titulo: "Permitted use",
            terminosS2Texto: "You may browse the catalog, search for products, and contact us for personal, legitimate purposes. Using the site for fraudulent, illegal purposes, or in ways that disrupt its normal operation is not allowed.",
            terminosS3Titulo: "Availability and pricing",
            terminosS3Texto: "Product, price, and availability information is updated periodically but may not reflect the exact real-time status. The final price and availability are always confirmed when you reach out.",
            terminosS4Titulo: "Intellectual property",
            terminosS4Texto: "The brand, logo, text, images, and design of this site belong to Licores Don Víctor, unless stated otherwise, and may not be copied or reused without authorization.",
            terminosS5Titulo: "Changes to these terms",
            terminosS5Texto: "We may update these terms at any time to reflect changes to the site or our services. The current version will always be available on this page.",
            terminosS6Titulo: "Contact",
            terminosS6Texto: "If you have questions about these terms, you can message us on WhatsApp or through the contact page.",
            privacidadTitulo: "Privacy Policy",
            privacidadIntro: "At Licores Don Víctor, we respect your privacy. This policy explains what information we collect through the site and how we use it.",
            privacidadS1Titulo: "Information we collect",
            privacidadS1Texto: "When you use the contact form, we collect the information you voluntarily enter: name, phone number, and your message. We do not ask for card details or process payments on the site.",
            privacidadS2Titulo: "How we use your information",
            privacidadS2Texto: "We use this data only to respond to your inquiry, check availability, and, when applicable, coordinate the sale directly via WhatsApp or in person at the store. We do not sell or share your information with third parties for unrelated commercial purposes.",
            privacidadS3Titulo: "WhatsApp and social media",
            privacidadS3Texto: "When you message us on WhatsApp, Facebook, or Instagram, your conversation is also subject to those platforms' own privacy policies, in addition to this one.",
            privacidadS4Titulo: "Cookies and browsing",
            privacidadS4Texto: "This site may use local browser storage (for example, to remember your preferred language) for purely functional purposes. We do not use this information to track you across other sites.",
            privacidadS5Titulo: "Your rights",
            privacidadS5Texto: "You may ask us at any time to update or delete any personal data you've shared with us by messaging us on WhatsApp or through the contact page.",
            privacidadS6Titulo: "Changes to this policy",
            privacidadS6Texto: "We may update this policy from time to time. Any changes will be posted on this same page.",
        },
    },
};

function dvObtenerIdiomaGuardado() {
    try {
        const guardado = window.localStorage.getItem(
            DV_IDIOMA_CLAVE_ALMACENAMIENTO
        );

        return guardado === "en" || guardado === "es"
            ? guardado
            : DV_IDIOMA_POR_DEFECTO;
    } catch (error) {
        return DV_IDIOMA_POR_DEFECTO;
    }
}

window.dvIdiomaActual = dvObtenerIdiomaGuardado();

function t(clave) {
    const partes = clave.split(".");
    let nodoActual = DV_DICCIONARIO[window.dvIdiomaActual];
    let nodoRespaldo = DV_DICCIONARIO.es;

    for (const parte of partes) {
        nodoActual = nodoActual ? nodoActual[parte] : undefined;
        nodoRespaldo = nodoRespaldo ? nodoRespaldo[parte] : undefined;
    }

    if (typeof nodoActual === "string") {
        return nodoActual;
    }

    if (typeof nodoRespaldo === "string") {
        return nodoRespaldo;
    }

    console.warn(`Falta traducción para la clave: ${clave}`);

    return clave;
}
window.t = t;

function dvEstablecerTextoTraducido(elemento, texto) {
    const nodosTexto = Array.from(elemento.childNodes).filter(
        (nodo) => nodo.nodeType === Node.TEXT_NODE && nodo.nodeValue.trim() !== ""
    );

    if (nodosTexto.length === 1 && elemento.children.length > 0) {
        const original = nodosTexto[0].nodeValue;
        const espacioInicial = /^\s/.test(original) ? " " : "";
        const espacioFinal = /\s$/.test(original) ? " " : "";

        nodosTexto[0].nodeValue = `${espacioInicial}${texto}${espacioFinal}`;

        return;
    }

    elemento.textContent = texto;
}

function dvTraducirDentroDe(raiz) {
    raiz.querySelectorAll("[data-i18n]").forEach((elemento) => {
        dvEstablecerTextoTraducido(elemento, t(elemento.dataset.i18n));
    });

    raiz.querySelectorAll("[data-i18n-html]").forEach((elemento) => {
        elemento.innerHTML = t(elemento.dataset.i18nHtml);
    });

    raiz.querySelectorAll("[data-i18n-placeholder]").forEach((elemento) => {
        elemento.setAttribute("placeholder", t(elemento.dataset.i18nPlaceholder));
    });

    raiz.querySelectorAll("[data-i18n-aria]").forEach((elemento) => {
        elemento.setAttribute("aria-label", t(elemento.dataset.i18nAria));
    });

    raiz.querySelectorAll("[data-i18n-title]").forEach((elemento) => {
        elemento.setAttribute("title", t(elemento.dataset.i18nTitle));
    });
}

function dvActualizarBotonIdioma() {
    const boton = document.getElementById("botonIdioma");

    if (!boton) {
        return;
    }

    const esIngles = window.dvIdiomaActual === "en";

    boton.setAttribute("data-idioma-activo", window.dvIdiomaActual);
    boton.setAttribute("aria-pressed", String(esIngles));
    boton.setAttribute(
        "aria-label",
        esIngles ? t("idioma.cambiarAEspanol") : t("idioma.cambiarAIngles")
    );
}

function dvAplicarIdioma(idioma, opciones) {
    const config = opciones || {};

    window.dvIdiomaActual = idioma === "en" ? "en" : "es";
    document.documentElement.lang = window.dvIdiomaActual;

    try {
        window.localStorage.setItem(
            DV_IDIOMA_CLAVE_ALMACENAMIENTO,
            window.dvIdiomaActual
        );
    } catch (error) {
        // Almacenamiento no disponible (modo privado, etc.): seguimos sin persistir.
    }

    dvTraducirDentroDe(document);
    dvActualizarBotonIdioma();

    if (!config.silencioso) {
        window.dispatchEvent(
            new CustomEvent("dv:idioma-cambio", {
                detail: { idioma: window.dvIdiomaActual },
            })
        );
    }
}
window.dvAplicarIdioma = dvAplicarIdioma;

function dvAlternarIdioma() {
    const boton = document.getElementById("botonIdioma");

    dvAplicarIdioma(window.dvIdiomaActual === "es" ? "en" : "es");

    if (boton) {
        boton.classList.remove("girando");
        // Forzar reflow para poder reiniciar la animación en clics seguidos.
        void boton.offsetWidth;
        boton.classList.add("girando");

        setTimeout(() => boton.classList.remove("girando"), 620);
    }
}

function dvInicializarIdioma() {
    dvAplicarIdioma(window.dvIdiomaActual, { silencioso: true });

    const boton = document.getElementById("botonIdioma");

    boton?.addEventListener("click", dvAlternarIdioma);
}
window.dvInicializarIdioma = dvInicializarIdioma;
