// Protege las páginas admin (excepto login.html). Se carga al final del
// body, con el DOM ya parseado: si no hay sesión o el usuario no es admin,
// redirige a login.html antes de que el <body style="visibility:hidden">
// llegue a mostrarse.
(async function protegerPaginaAdmin() {
    const { data: { session } } = await window.supabaseClient.auth.getSession();

    if (!session) {
        window.location.replace("login.html");
        return;
    }

    const { data: perfil, error } = await window.supabaseClient
        .from("perfiles")
        .select("rol, estado, nombre")
        .eq("id", session.user.id)
        .single();

    if (error || !perfil || perfil.rol !== "admin" || perfil.estado !== true) {
        await window.supabaseClient.auth.signOut();
        window.location.replace("login.html");
        return;
    }

    window.adminUsuario = {
        id: session.user.id,
        email: session.user.email,
        nombre: perfil.nombre
    };

    document.body.style.visibility = "visible";
    document.dispatchEvent(new CustomEvent("admin-listo"));
})();
