document.addEventListener("DOMContentLoaded", async () => {
    const formulario = document.getElementById("formularioLogin");
    const boton = document.getElementById("botonLogin");
    const feedback = document.getElementById("loginFeedback");

    // Si ya hay una sesión de admin válida, no mostrar el login de nuevo.
    const { data: { session } } = await window.supabaseClient.auth.getSession();

    if (session) {
        const { data: perfil } = await window.supabaseClient
            .from("perfiles")
            .select("rol, estado")
            .eq("id", session.user.id)
            .single();

        if (perfil && perfil.rol === "admin" && perfil.estado === true) {
            window.location.replace("index.html");
            return;
        }
    }

    formulario.addEventListener("submit", async (evento) => {
        evento.preventDefault();
        feedback.textContent = "";

        if (!formulario.reportValidity()) {
            return;
        }

        if (boton.disabled) {
            return;
        }

        boton.disabled = true;
        boton.classList.add("admin-boton-cargando");

        const email = formulario.elements.email.value.trim();
        const password = formulario.elements.password.value;

        try {
            const { data, error } = await window.supabaseClient.auth.signInWithPassword({
                email,
                password
            });

            if (error) {
                throw error;
            }

            const { data: perfil, error: errorPerfil } = await window.supabaseClient
                .from("perfiles")
                .select("rol, estado")
                .eq("id", data.session.user.id)
                .single();

            if (errorPerfil || !perfil || perfil.rol !== "admin" || perfil.estado !== true) {
                await window.supabaseClient.auth.signOut();
                feedback.textContent = "Esta cuenta no tiene acceso al panel administrativo.";
                return;
            }

            window.location.replace("index.html");
        } catch (error) {
            feedback.textContent = "Correo o contraseña incorrectos.";
            console.error("Error de login:", error);
        } finally {
            boton.disabled = false;
            boton.classList.remove("admin-boton-cargando");
        }
    });
});
