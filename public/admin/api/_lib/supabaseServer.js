// Cliente de Supabase para las funciones serverless del admin. Usa la MISMA
// URL/clave anon públicas que public/js/config/supabase-client.js (la clave
// anon está pensada para exponerse; la seguridad la da RLS, no ocultarla).
//
// A propósito NO se usa la service_role key en ningún lado: cada función
// crea un cliente "en nombre del usuario" reenviando su propio access_token
// como Authorization header, así que PostgREST evalúa exactamente las mismas
// políticas RLS que ya se evalúan cuando el navegador llama a Supabase
// directamente (ver supabase/migrations/20260731020624_admin_auth_and_write_rls.sql).
// Esto evita introducir un secreto nuevo y de alto privilegio.
"use strict";

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = "https://babglruyhltjncvaryvz.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_6rKNR8pMDZRuvWz4hTbJSA_-aVol7Ml";

class HttpError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

function extraerToken(req) {
    const encabezado = req.headers && req.headers.authorization;
    if (!encabezado || !encabezado.startsWith("Bearer ")) {
        return null;
    }
    return encabezado.slice("Bearer ".length).trim();
}

function crearClienteConToken(token) {
    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: "Bearer " + token } },
        auth: { persistSession: false, autoRefreshToken: false }
    });
}

// Verifica que la petición traiga una sesión válida de Supabase Y que el
// usuario sea admin activo (mismo criterio que auth-guard.js en el
// navegador, pero evaluado en el backend para no confiar en el frontend).
async function requerirAdmin(req) {
    const token = extraerToken(req);
    if (!token) {
        throw new HttpError(401, "No autenticado.");
    }

    const cliente = crearClienteConToken(token);
    const { data: userData, error: errorUsuario } = await cliente.auth.getUser(token);

    if (errorUsuario || !userData || !userData.user) {
        throw new HttpError(401, "Sesión inválida o expirada.");
    }

    const { data: perfil, error: errorPerfil } = await cliente
        .from("perfiles")
        .select("rol, estado")
        .eq("id", userData.user.id)
        .single();

    if (errorPerfil || !perfil || perfil.rol !== "admin" || perfil.estado !== true) {
        throw new HttpError(403, "No autorizado.");
    }

    return { cliente: cliente, usuario: userData.user };
}

module.exports = { HttpError, crearClienteConToken, requerirAdmin, SUPABASE_URL, SUPABASE_ANON_KEY };
