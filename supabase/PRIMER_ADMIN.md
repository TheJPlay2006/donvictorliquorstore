# Crear el primer administrador (proyecto real)

Antes de esto, aplicá las migraciones de esta fase (`20260731020624_admin_auth_and_write_rls.sql` y `20260731021519_storage_buckets_and_policies.sql`) en el SQL Editor de tu proyecto real (`https://supabase.com/dashboard/project/babglruyhltjncvaryvz/sql/new`), igual que hiciste con las de la Fase 1 — pegá el contenido de cada archivo y ejecutalo.

No hay registro público ni forma de que alguien se auto-asigne `rol='admin'` desde el cliente (a propósito). Todo admin nuevo pasa por estos pasos manuales:

1. Andá a `Authentication → Users` en el dashboard de tu proyecto.
2. `Add user` — cargá el email y una contraseña para la cuenta admin (o usá "Invite user" si preferís que la persona la defina ella misma).
3. Confirmá que el usuario quede con el email verificado (revisá la config de `Authentication → Providers → Email` si tu proyecto exige confirmación).
4. Copiá el `id` (uuid) de ese usuario desde la tabla de Users.
5. En el SQL Editor, corré (reemplazando el uuid y el nombre):

```sql
insert into public.perfiles (id, nombre, rol, estado)
values ('UUID_DEL_USUARIO', 'Nombre del admin', 'admin', true)
on conflict (id) do update set
    nombre = excluded.nombre,
    rol = 'admin',
    estado = true;
```

6. Verificá: `select * from public.perfiles;` — debería mostrar la fila con `rol = 'admin'`.
7. Entrá a `/admin/login.html` en el sitio desplegado con ese email/contraseña.

Para agregar más administradores más adelante, repetí estos mismos pasos — no hay atajo desde la UI del panel, es intencional.
