# Licores Don Víctor

Catálogo web para Licores Don Víctor (La Fortuna, Costa Rica). Sitio estático
(HTML/CSS/JS, sin framework ni build step) con Supabase como único backend:
Postgres + RLS para datos, Storage para imágenes, Auth para el panel
administrativo. La conversión ocurre por WhatsApp — no hay carrito ni checkout.

## Arquitectura

```
GitHub (este repo)
   │
   ├── Vercel — donvictorliquorstore          (Root Directory: public)
   │      catálogo público, sin login, sin enlaces al admin
   │
   ├── Vercel — donvictorliquorstore-admin    (Root Directory: public/admin)
   │      panel administrativo, requiere sesión + rol admin
   │
   └── supabase/
          migrations/   schema + RLS + Storage
          seed.sql      datos reales (categorías y productos existentes)
```

Los dos deployments comparten el **mismo proyecto Supabase**. No hay servidor
Node en producción — todo el acceso a datos ocurre desde el navegador vía
`@supabase/supabase-js` (clave pública) contra la Data API de Supabase,
protegido por Row Level Security. `public/admin/` es una copia autocontenida
de los assets compartidos (`css/estilos.css`, `js/config/supabase-client.js`,
`img/logo.png`) — no usa rutas `../` porque Vercel lo despliega con un Root
Directory distinto al catálogo, así que no puede depender de archivos fuera
de esa carpeta. Si cambiás el diseño global, hay que copiar los cambios a
`public/admin/css/estilos.css` a mano.

## Desarrollo local

```bash
npm install
npm run dev              # sirve public/ en :3000 (npx serve)
npm run supabase:start   # levanta Postgres/Auth/Storage local (Docker)
npm run supabase:reset   # reaplica migraciones + seed contra el stack local
npm run supabase:stop    # detiene el stack local
```

`public/js/config/supabase-client.js` detecta automáticamente si estás en
`localhost`/`127.0.0.1` y usa el stack local (`http://127.0.0.1:54321` con la
clave anon de demo que imprime `supabase start`); en cualquier otro host usa
el proyecto real. No hay que tocar nada para alternar entre local y producción.

No hay scripts de test ni build — es HTML/CSS/JS servido tal cual, no hay
paso de compilación.

## Supabase

### Esquema

`supabase/migrations/` (aplican en orden):
1. `categorias` y `productos` — mismas columnas que el dump original de
   PostgreSQL (`database/don_victor.sql`, conservado solo como respaldo
   histórico, ya no es el sistema de migraciones activo).
2. `perfiles` (roles de admin) + función `es_admin()` + políticas de
   escritura para `categorias`/`productos`.
3. Buckets de Storage (`productos`, `categorias`) + políticas.

### RLS

- **Lectura pública** (`anon`/`authenticated`): solo filas con `estado = true`
  en `categorias`/`productos`.
- **Admin** (`authenticated` + fila propia en `perfiles` con `rol='admin'` y
  `estado=true`): puede leer, crear y editar todas las filas (incluidas las
  desactivadas). No hay borrado físico — "eliminar" un producto o categoría
  es poner `estado=false`.
- **`perfiles`**: cada usuario solo puede leer su propia fila. Nadie puede
  escribir esa tabla desde el cliente (ni su propia fila) — el rol admin se
  asigna únicamente por SQL manual, nunca desde la UI.
- **Storage**: lectura pública de los buckets `productos`/`categorias`,
  escritura (subir/reemplazar/borrar) solo para admins.

### Aplicar a un proyecto Supabase real

```bash
npx supabase login
npx supabase link --project-ref <tu-project-ref>
npx supabase migration list        # compara migraciones locales vs. remotas
npx supabase db push --dry-run     # previsualiza sin aplicar nada
npx supabase db push               # aplica de verdad
```

Si `db push` no es una opción (sin acceso a la CLI, por ejemplo), las
migraciones también se pueden pegar directamente en el SQL Editor del
dashboard — el contenido exacto para copiar/pegar de una sola vez está en
`supabase/APLICAR_A_PROYECTO_REAL.md` (schema + RLS de la Fase 1) y
`supabase/APLICAR_FASE2_A_PROYECTO_REAL.md` (perfiles + RLS de escritura +
Storage de la Fase 2).

Verificar que quedó bien aplicado (en el SQL Editor o por psql):

```sql
select count(*) from public.categorias;   -- 11
select count(*) from public.productos;    -- 4
select tablename, policyname, cmd from pg_policies
    where schemaname in ('public','storage') order by 1,3;
select id, public from storage.buckets;   -- productos, categorias
```

### Crear el primer administrador

No hay registro público — es intencional, nadie puede auto-asignarse el rol
admin. Pasos manuales (detallados en `supabase/PRIMER_ADMIN.md`):

1. Dashboard → **Authentication → Users → Add user** (email + contraseña).
2. Copiar el `id` (uuid) del usuario recién creado.
3. En el SQL Editor:
   ```sql
   insert into public.perfiles (id, nombre, rol, estado)
   values ('<uuid-copiado>', 'Nombre del admin', 'admin', true)
   on conflict (id) do update set
       nombre = excluded.nombre,
       rol = 'admin',
       estado = true;
   ```
4. Iniciar sesión en `/admin/login.html` (o `https://donvictorliquorstore-admin.vercel.app/login.html`
   una vez desplegado) con ese email/contraseña.

### Auth — URL Configuration

En el dashboard del proyecto real, **Authentication → URL Configuration**:

- **Site URL**: `https://donvictorliquorstore-admin.vercel.app`
- **Redirect URLs**:
  ```
  https://donvictorliquorstore-admin.vercel.app/**
  http://127.0.0.1:3001/**
  http://localhost:3001/**
  ```

No uses la URL del catálogo público como Site URL — el catálogo nunca inicia
sesión, solo el admin lo hace.

## Panel administrativo (`public/admin/`)

- `login.html` — email/contraseña vía `supabase.auth.signInWithPassword`. Sin
  registro. Verifica el rol contra `perfiles` antes de dejar pasar; si no es
  admin, cierra la sesión y muestra "acceso denegado".
- `index.html` — landing con accesos a Productos/Categorías.
- `productos.html` / `producto-form.html` — listar (con búsqueda y filtro por
  categoría), crear, editar, togglear disponible/destacado/promoción/estado,
  subir imagen (se convierte a WebP y se redimensiona a máx. 900px en el
  navegador antes de subir a Storage).
- `categorias.html` — listar, crear/editar (panel inline), togglear
  mostrar-en-inicio/estado, subir imagen.
- `js/admin/auth-guard.js` — corre en todas las páginas protegidas: sin
  sesión o sin rol admin, redirige a `login.html` antes de mostrar nada
  (`<body style="visibility:hidden">` hasta confirmar). Esto es solo UX — el
  candado real es RLS, no confíes en que la URL del admin sea secreta.

No existe ningún enlace desde el catálogo público hacia el admin.

## Configuración de Vercel

Dos proyectos apuntando al mismo repositorio de GitHub, mismo Supabase.

### `donvictorliquorstore` (catálogo)

| Config | Valor |
|---|---|
| Root Directory | `public` |
| Framework Preset | Other (sitio estático) |
| Install Command | *(vacío — no hay dependencias de build)* |
| Build Command | *(vacío)* |
| Output Directory | `.` |

### `donvictorliquorstore-admin` (panel)

| Config | Valor |
|---|---|
| Root Directory | `public/admin` |
| Framework Preset | Other (sitio estático) |
| Install Command | *(vacío)* |
| Build Command | *(vacío)* |
| Output Directory | `.` |

Ninguno de los dos proyectos necesita variables de entorno en Vercel: la URL
y la clave anon de Supabase están hardcodeadas en
`public/js/config/supabase-client.js` (y su copia en `public/admin/js/config/`)
porque son públicas por diseño — la seguridad la da RLS, no ocultar esa
clave. **Nunca** agregues `SUPABASE_SECRET_KEY`/`service_role` a ningún
proyecto de Vercel de este repo.

`public/vercel.json` y `public/admin/vercel.json` fijan `cleanUrls: false` +
un rewrite de `/` a `/index.html` — sin eso, las URLs con query string como
`categorias.html?categoria=ron` pueden redirigir mal.

No verifiqué esto contra un deployment real de Vercel en esta sesión —
solo simulé Root Directory sirviendo `public/` y `public/admin/` por
separado con `npx serve` localmente, con resultado correcto (cero 404 de
assets). Confirmalo con un deploy real antes de darlo por bueno del todo.

## Variables de entorno

`.env.example` documenta `SUPABASE_URL`/`SUPABASE_PUBLISHABLE_KEY` como
referencia — ningún código de servidor las lee hoy (no hay servidor). Son
útiles solo si en el futuro se agrega alguna herramienta local (como un
eventual script de importación de imágenes) que sí necesite credenciales de
servidor vía `.env.local` (nunca commiteado).

## Solución de problemas

- **`categorias.html?categoria=<slug>` no filtra / redirige raro en local**:
  es `npx serve` con clean URLs, no un bug del sitio — confirmá que
  `public/serve.json` (o `public/admin/serve.json`) existe con `cleanUrls:false`.
- **El admin no ve productos desactivados**: confirmá que tu usuario tiene
  fila en `perfiles` con `rol='admin'` y `estado=true` — sin eso, `es_admin()`
  devuelve `false` y solo ves lo mismo que un visitante.
- **Login funciona pero redirige de vuelta a login.html**: la cuenta existe
  en Auth pero no tiene fila en `perfiles`, o tiene `rol='usuario'`.
- **Imágenes rotas en el admin**: las imágenes legacy (sembradas desde el
  dump) son rutas relativas (`img/productos/foo.jpg`); las subidas desde el
  panel son URLs completas de Storage. Ambas se guardan en la misma columna
  `imagen` y funcionan igual en `<img src>`, no deberían romperse — si se
  rompen, revisá que el bucket sea público (`select public from
  storage.buckets`).

## Seguridad

- RLS es el único mecanismo de control de acceso — la clave anon/publishable
  es segura de exponer en el navegador por diseño.
- La clave `service_role`/secreta nunca debe estar en `public/`, en ningún
  archivo commiteado, ni en variables de entorno de Vercel de este repo.
- No hay registro público ni forma de auto-asignarse `rol='admin'` — todo
  admin nuevo se crea manualmente vía SQL (ver arriba).
- Sin borrado físico de productos/categorías por defecto — solo `estado=false`.
