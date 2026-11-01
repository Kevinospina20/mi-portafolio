# Portafolio personal de Kevin

Web personal responsive para presentar tu perfil, hoja de vida, proyectos de GitHub y redes sociales. Incluye tema oscuro/claro, navegación adaptable a móvil y un diseño editorial con animaciones discretas.

## Estructura

```text
.
├── index.html         # Secciones y contenido semántico
├── styles.css         # Diseño, tema claro/oscuro y breakpoints responsive
├── .gitignore         # Ignora credenciales locales y archivos de desarrollo
├── vercel.json        # Regla para la ruta /admin
├── admin/
│   ├── index.html     # Inicio de sesión y formularios privados
│   └── admin.css      # Estilos del dashboard
├── js/
│   ├── config.js       # Perfil, redes, GitHub y claves públicas de Supabase
│   ├── content.js      # Supabase Auth, contenido, guardado y Realtime
│   ├── github.js       # Consulta y tarjetas de repositorios públicos
│   ├── main.js         # Navegación, tema y contenido público en vivo
│   └── admin.js        # Login, edición y guardado del dashboard
└── README.md
```

La web no necesita compilación ni instalación de paquetes. Supabase es opcional: sin configurarlo, el sitio usa `js/config.js`. Al conectar una tabla pública de solo lectura, el contenido remoto sobrescribe esos datos locales.

## 1. Personaliza el perfil

Abre `js/config.js` y reemplaza los valores de ejemplo. Puedes añadir varias experiencias, estudios y habilidades; el formato está listo:

```js
profile: {
  name: "Kevin Apellido",
  firstName: "Kevin",
  role: "Tu cargo o especialidad",
  location: "Ciudad, Colombia",
  shortBio: "Una frase corta para tu tarjeta lateral.",
  intro: "Tu presentación profesional en dos o tres líneas.",
  email: "tu.correo@ejemplo.com",
  quote: "Una frase que represente tu forma de trabajar.",
  stats: { years: "3+", projects: "12+" },
  experience: [
    {
      period: "2023 — Actualidad",
      title: "Cargo o función",
      organization: "Empresa u organización",
      description: "Responsabilidades, aportes o resultados concretos.",
    },
  ],
  education: [
    {
      period: "2020 — 2024",
      title: "Título o programa",
      organization: "Institución educativa",
      description: "Énfasis, reconocimientos o formación complementaria.",
    },
  ],
  skills: [
    { name: "JavaScript", level: 80, group: "TÉCNICAS" },
    { name: "Comunicación", level: 90, group: "PERSONALES" },
  ],
},
```

`level` va de 0 a 100. Si aún no tienes experiencias o estudios que mostrar, deja `experience: []` o `education: []`; el sitio mostrará una invitación discreta para completar esos apartados. Cambia las habilidades de ejemplo por las tuyas. El diseño inicial usa «Kevin» porque es el nombre disponible en este espacio de trabajo; el apellido, cargo, historia y enlaces quedan a tu elección.

## 2. Conecta GitHub

1. Crea o usa tu cuenta en [GitHub](https://github.com/).
2. En `js/config.js`, cambia `githubUsername: "TU_USUARIO_GITHUB"` por el nombre exacto que aparece al final de `https://github.com/tu-usuario`.
3. En el mismo archivo, reemplaza la URL de GitHub dentro de `socials` por `https://github.com/tu-usuario`.
4. Publica repositorios como **públicos**. La página consulta los repositorios públicos del perfil, excluye forks y muestra hasta nueve, ordenados por actualización.
5. La sección GitHub cambia de estado automáticamente: muestra una invitación con tu perfil si todavía no hay repositorios propios; al crear el primero, lo presenta como tarjeta con descripción, lenguaje, estrellas, forks y fecha de actualización.

La API pública no necesita token para leer repositorios públicos. Las peticiones sin autenticar tienen un límite compartido por dirección IP; GitHub documenta un máximo general de 60 solicitudes por hora. No pegues un token personal en `config.js`, HTML o JavaScript del navegador: cualquiera podría verlo en el código publicado. Si más adelante necesitas autenticación o más cuota, crea un endpoint serverless y guarda el token como variable de entorno privada en Vercel; el endpoint consulta GitHub en nombre de la página. [Documentación oficial de límites de la API](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api).

**Token opcional, solo si una API de servidor llega a necesitarlo:** esta página no consume tokens. Para aumentar la cuota más adelante, primero habría que añadir una función serverless que haga la consulta a GitHub. Después crea un token con alcance mínimo: GitHub → tu avatar → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**; elige tu usuario como resource owner, acceso a los repositorios necesarios, expiración y solo permiso de repositorio **Metadata: Read-only**. La lectura de repositorios públicos puede hacerse sin token; GitHub documenta Metadata como permiso para el endpoint y que los recursos públicos se pueden leer sin autenticación. Copia el token al crearlo y añádelo en Vercel → **Project → Settings → Environment Variables** como `GITHUB_TOKEN`, con valor privado y habilitado para Production/Preview según necesites; vuelve a desplegar. La función serverless futura debe leer `process.env.GITHUB_TOKEN`. **No añadas este valor a `js/config.js` ni a las variables con prefijo público `VITE_`/`NEXT_PUBLIC_`**: en el frontend se expondría. Guía oficial: [crear y administrar tokens personales](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens).

### Redes sociales

En `socials`, cambia cada URL `"#"` por el enlace directo a tu perfil. Instagram usa `https://instagram.com/usuario`; LinkedIn, `https://linkedin.com/in/usuario`; Discord puede usar `https://discord.com/users/ID_NUMÉRICO`. Las redes que dejes como `"#"` no aparecen como enlaces, aunque Instagram, Discord y LinkedIn seguirán visibles como tarjetas desactivadas que te recuerdan completar sus URLs.

## 3. Supabase y el panel `/admin`

El sitio lee una fila JSON pública. El dashboard autentica por email/contraseña con Supabase Auth, verifica el rol usando `is_portfolio_admin()` y guarda con la publishable key. RLS limita las escrituras a los UUID que estén en `portfolio_admins`. La clave secreta de Supabase nunca se pone en el navegador.

1. Crea un proyecto en [supabase.com](https://supabase.com/). En **Authentication → Sign In / Providers**, habilita Email. En **Authentication → General Configuration**, desactiva **Allow new users to sign up** para cerrar el registro público; la allowlist de UUID de los pasos siguientes define quién puede editar.
2. Ve a **Authentication → Users → Add user** y crea/invita tu usuario administrador. Si envías una invitación, abre el correo y completa la creación de la contraseña. En **Authentication → URL Configuration**, define el Site URL y añade las URLs permitidas de prueba/despliegue (por ejemplo `http://localhost:8000/**` y `https://TU_PROYECTO.vercel.app/**`) para que los enlaces de invitación regresen al sitio.
3. En **SQL Editor → New query**, ejecuta una sola vez este SQL. Crea el contenido, las reglas de lectura/escritura y el canal de Realtime:

   ```sql
   create table if not exists public.portfolio_content (
     id text primary key,
     content jsonb not null default '{}'::jsonb,
     updated_at timestamptz not null default now()
   );

   alter table public.portfolio_content enable row level security;

   revoke all on public.portfolio_content from anon, authenticated;
   grant select on public.portfolio_content to anon, authenticated;

   drop policy if exists "Public can read portfolio content" on public.portfolio_content;
   create policy "Public can read portfolio content"
   on public.portfolio_content
   for select
   to anon, authenticated
   using (true);

   create table if not exists public.portfolio_admins (
     user_id uuid primary key references auth.users(id) on delete cascade,
     created_at timestamptz not null default now()
   );
   alter table public.portfolio_admins enable row level security;
   revoke all on public.portfolio_admins from anon, authenticated;

   create or replace function public.is_portfolio_admin()
   returns boolean
   language sql
   stable
   security definer
   set search_path = ''
   as $$
     select exists (
       select 1 from public.portfolio_admins
       where user_id = (select auth.uid())
     );
   $$;
   revoke all on function public.is_portfolio_admin() from public;
   grant execute on function public.is_portfolio_admin() to authenticated;

   grant insert, update on public.portfolio_content to authenticated;
   drop policy if exists "Admins can insert portfolio content" on public.portfolio_content;
   create policy "Admins can insert portfolio content"
   on public.portfolio_content for insert to authenticated
   with check ((select public.is_portfolio_admin()));
   drop policy if exists "Admins can update portfolio content" on public.portfolio_content;
   create policy "Admins can update portfolio content"
   on public.portfolio_content for update to authenticated
   using ((select public.is_portfolio_admin()))
   with check ((select public.is_portfolio_admin()));

   do $$
   begin
     if not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'portfolio_content'
     ) then
       alter publication supabase_realtime add table public.portfolio_content;
     end if;
   end;
   $$;

   insert into public.portfolio_content (id, content)
   values (
     'main',
     '{
       "profile": {
         "name": "Kevin",
         "firstName": "Kevin",
         "role": "Tu profesión, a tu manera",
         "location": "Colombia",
         "shortBio": "Construyo ideas con intención, curiosidad y atención a los detalles.",
         "intro": "Un espacio para compartir mi recorrido, lo que me inspira y los proyectos que estoy construyendo.",
         "email": "",
         "quote": "Las buenas ideas toman forma cuando les damos el espacio para crecer.",
         "stats": { "years": "—", "projects": "—" },
         "experience": [],
         "education": [],
         "skills": [
           { "name": "Comunicación", "level": 80, "group": "PERSONALES" },
           { "name": "Resolución de problemas", "level": 75, "group": "PERSONALES" },
           { "name": "Aprendizaje continuo", "level": 90, "group": "PERSONALES" }
         ]
       },
       "socials": [
         { "name": "Instagram", "handle": "Tu espacio visual", "url": "#", "icon": "instagram", "color": "coral" },
         { "name": "Discord", "handle": "Conversemos por aquí", "url": "#", "icon": "discord", "color": "violet" },
         { "name": "LinkedIn", "handle": "Conecta conmigo", "url": "#", "icon": "linkedin", "color": "blue" },
         { "name": "GitHub", "handle": "Código e ideas", "url": "#", "icon": "github", "color": "lime" }
       ]
     }'::jsonb
   )
   on conflict (id) do update set content = excluded.content, updated_at = now();
   ```

4. En **Authentication → Users**, copia el UUID del usuario administrador creado en el paso 2. En SQL Editor ejecuta este comando con ese UUID:

   ```sql
   insert into public.portfolio_admins (user_id)
   values ('UUID-DEL-USUARIO-AQUI')
   on conflict (user_id) do nothing;
   ```

   Solo los UUID que añadas a esta tabla podrán editar. Si eliminas la fila de un administrador, pierde el permiso de escritura.
5. En **Project Settings → API Keys**, copia la **Project URL** y la **Publishable key** (`sb_publishable_...`). Si el panel ofrece la clave heredada `anon`, también puede usarse, pero prefiere la publishable nueva. No copies la `secret`/`service_role` key a los archivos de la web.
6. Pega los valores en `js/config.js`:

   ```js
   supabase: {
     url: "https://TU_PROJECT_REF.supabase.co",
     publishableKey: "sb_publishable_TU_CLAVE_PUBLICA",
     contentTable: "portfolio_content",
     contentId: "main",
   },
   ```

7. Guarda `config.js`, sirve la web localmente o despliega de nuevo una sola vez para incluir la configuración de Supabase. Luego abre `/admin/`, inicia sesión y edita el formulario, incluidas las URLs de redes y el usuario de GitHub. El frontend verifica el usuario y su UUID en la allowlist antes de mostrar el editor; aun si alguien intenta saltarse la pantalla de login, las políticas RLS impiden que una cuenta no autorizada escriba. A partir de ahí los cambios se guardan en la tabla sin nuevo deploy.
8. En la web pública, Supabase Realtime escucha inserciones y actualizaciones de la fila `main`; la sección abierta se repinta al llegar el cambio. En la misma pestaña del dashboard verás el mensaje de guardado inmediatamente; abre el portafolio para ver los cambios. Si no llegan eventos, revisa que `portfolio_content` figure en **Database → Publications → supabase_realtime** y que la fila permita `SELECT` público.

El ejemplo SQL reemplaza el JSON de `main` por los valores iniciales del README. Si ya tienes una fila con información que quieras conservar, cambia el bloque `insert ... on conflict ... do update` por `on conflict (id) do nothing` antes de ejecutarlo. Guías oficiales: [Data API y claves](https://supabase.com/docs/guides/api), [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security), [usuarios de Auth](https://supabase.com/docs/guides/auth/users) y [Postgres Changes en Realtime](https://supabase.com/docs/guides/realtime/postgres-changes).

## 4. Vista previa local

Los módulos JavaScript ES no funcionan bien al abrir `index.html` con doble clic (`file://`). Sirve la carpeta por HTTP con una de estas opciones:

- **VS Code:** instala la extensión Live Server, abre `index.html` y selecciona **Open with Live Server**.
- **Node.js:** desde la raíz del proyecto ejecuta `npx serve .` y abre la dirección local que muestre la terminal.
- **Python:** desde la raíz ejecuta `python -m http.server 8000`, abre `http://localhost:8000` para el portafolio o `http://localhost:8000/admin/` para el panel.

## 5. Publica gratis en GitHub y Vercel

### Sube el proyecto a GitHub

1. Inicia sesión en [GitHub](https://github.com/) y crea un repositorio nuevo. Para un portafolio, puedes llamarlo `mi-portafolio`. No inicialices el repositorio con README ni archivos si vas a subir esta carpeta existente.
2. Instala Git y abre PowerShell o Terminal en la carpeta del proyecto. Ejecuta:

   ```bash
   git init
   git add .gitignore index.html styles.css js admin vercel.json README.md
   git commit -m "Crear portafolio personal"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/mi-portafolio.git
   git push -u origin main
   ```

3. Sustituye `TU_USUARIO` y `mi-portafolio` por los valores de tu cuenta y del repositorio. GitHub puede pedirte autenticarte en el navegador o con Git Credential Manager; no escribas contraseñas ni tokens en este archivo.

   Si prefieres una interfaz gráfica, GitHub Desktop permite **Add an Existing Repository** para esta carpeta y luego **Publish repository**. La guía oficial también describe el flujo desde la terminal: [Añadir código local a GitHub](https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github).

### Conecta el repositorio a Vercel

1. Entra en [vercel.com](https://vercel.com/) y regístrate o inicia sesión con GitHub.
2. En el panel, selecciona **Add New → Project**, importa `mi-portafolio` y autoriza a Vercel para leer ese repositorio.
3. En la configuración de compilación selecciona **Other** como Framework Preset, deja **Build Command** vacío y usa la raíz del repositorio como **Output Directory** (`.`). No hay proceso de build ni dependencias que instalar. `vercel.json` ya incluye una reescritura para que `/admin` abra el dashboard.
4. Si activaste Supabase, puedes dejar URL y publishable key en `js/config.js` (esos dos valores son públicos) o guardar variables públicas de compilación y conectarlas a la configuración antes de desplegar. No agregues claves secretas al cliente.
5. Pulsa **Deploy**. Vercel publica el sitio en una URL `*.vercel.app`; cada `git push` a la rama conectada crea una nueva implementación. La guía de Vercel confirma que un sitio HTML/JS estático puede desplegarse sin comando de compilación: [Static sites y configuración de builds](https://vercel.com/docs/builds/configure-a-build).

El proyecto es estático, por lo que no requiere servidor propio. Disponibilidad, cuotas gratuitas, funciones incluidas y condiciones de Vercel, GitHub o Supabase dependen de los planes vigentes de cada proveedor; revisa sus páginas al crear las cuentas.

## Notas técnicas

- La preferencia de tema claro/oscuro se guarda en el navegador.
- La navegación cambia entre cuatro vistas y adapta el menú a pantallas pequeñas.
- El dashboard de `/admin/` usa Supabase Auth, una allowlist de UUID en `portfolio_admins` y RLS para limitar las escrituras; ocultar la ruta no se usa como mecanismo de seguridad.
- La página pública se suscribe a Supabase Realtime para aplicar el contenido actualizado sin un nuevo deploy. La tabla debe estar añadida a la publicación `supabase_realtime`.
- GitHub se consulta directamente desde el navegador usando su API pública. Si no hay perfil configurado, se muestra un estado inicial elegante y un enlace a GitHub.
- El texto recibido desde Supabase y GitHub se escapa antes de renderizarse.
- Los archivos PDF están ignorados por Git para evitar publicar documentos personales por accidente; agrega explícitamente cualquier CV descargable que quieras hacer público.
- Para ofrecer un PDF descargable, agrega explícitamente el CV que quieras publicar y enlázalo desde el sitio. El PDF fuente que ya estaba en esta carpeta queda ignorado por Git y no se ofrece como descarga.
