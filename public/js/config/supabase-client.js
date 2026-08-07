// Cliente de Supabase para el frontend público (solo lectura, protegido por
// RLS — ver supabase/migrations/). La clave anon/publishable está diseñada
// para exponerse en el navegador: la seguridad la da RLS, no ocultar esta
// clave. Nunca poner aquí la clave secreta/service_role.

// En localhost/127.0.0.1 apunta al stack local de `supabase start` (útil
// para probar sin tocar el proyecto real); en cualquier otro host usa el
// proyecto real. La clave anon local es siempre la misma clave de demo que
// imprime la CLI, no un secreto.
var esLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);

window.SUPABASE_URL = esLocal
    ? 'http://127.0.0.1:54321'
    : 'https://babglruyhltjncvaryvz.supabase.co';

window.SUPABASE_ANON_KEY = esLocal
    ? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
    : 'sb_publishable_6rKNR8pMDZRuvWz4hTbJSA_-aVol7Ml';

window.supabaseClient = supabase.createClient(
    window.SUPABASE_URL,
    window.SUPABASE_ANON_KEY
);

// PostgREST devuelve la relación embebida como { categorias: { nombre } }.
// Esto la aplana a producto.categoria (string), igual que el JOIN de SQL
// original ("c.nombre AS categoria"), para no tener que tocar el resto de
// las funciones de renderizado de tarjetas.
window.aplanarProductos = function (filas) {
    return (filas || []).map(function (fila) {
        var categoria = fila.categorias ? fila.categorias.nombre : null;
        var resto = Object.assign({}, fila);
        delete resto.categorias;
        resto.categoria = categoria;
        return resto;
    });
};
