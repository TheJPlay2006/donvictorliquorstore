// Rutas relativas legacy guardadas en `imagen` (ej. "img/productos/foo.jpg")
// están pensadas para servirse desde la raíz de public/. Las URLs completas de
// Storage/http no se tocan. En local dev (`npm run dev` sirve todo public/
// junto, admin incluido) "../" resuelve bien; en producción el admin es un
// proyecto de Vercel separado sin acceso al árbol de archivos del catálogo,
// así que ahí se resuelve contra el dominio real del catálogo público.
var ES_LOCAL_ADMIN_CHROME =
    ["localhost", "127.0.0.1"].includes(window.location.hostname);

var URL_CATALOGO_PUBLICO_ADMIN_CHROME =
    "https://donvictorliquorstore.vercel.app";

window.resolverRutaImagenAdmin = function (imagen) {
    if (!imagen) {
        return imagen;
    }
    if (/^(https?:)?\/\//.test(imagen) || imagen.startsWith("data:")) {
        return imagen;
    }
    return ES_LOCAL_ADMIN_CHROME
        ? "../" + imagen
        : `${URL_CATALOGO_PUBLICO_ADMIN_CHROME}/${imagen}`;
};

// Cablea el topbar admin (nombre de usuario, cerrar sesión). Espera a que
// auth-guard.js confirme la sesión antes de mostrar datos del usuario.
document.addEventListener("admin-listo", () => {
    const nombreUsuario = document.getElementById("adminNombreUsuario");

    if (nombreUsuario && window.adminUsuario) {
        nombreUsuario.textContent =
            window.adminUsuario.nombre || window.adminUsuario.email;
    }
});

document.addEventListener("DOMContentLoaded", () => {
    const botonSalir = document.getElementById("adminCerrarSesion");

    if (botonSalir) {
        botonSalir.addEventListener("click", async () => {
            await window.supabaseClient.auth.signOut();
            window.location.replace("login.html");
        });
    }
});
