# Activar FamilyOS privado en Supabase y Vercel

El código ya contiene autenticación, autorización PostgreSQL, sincronización y administración de colaboradores. Admite un proyecto exclusivo o, con autorización del propietario, un proyecto compartido usando el esquema aislado `familyos`. Las pruebas locales no sustituyen la verificación de Auth, correo y sincronización alojados. La demo pública sigue separada en `/demo`.

No necesitas compartir contraseñas ni claves por chat ni agregarlas a GitHub.

## 1. Crear un proyecto Supabase

Para una instalación independiente, abre [Supabase](https://supabase.com/dashboard) y crea un proyecto de producción exclusivo de FamilyOS. Para compartir un proyecto existente, sigue la sección «Proyecto compartido» al final; no instales las tablas de FamilyOS en el esquema `public` de la otra aplicación. Conserva la contraseña de PostgreSQL en tu gestor de contraseñas; la app no necesita esa contraseña en Vercel.

En Project Settings → API/Data API confirma que `public` está entre los esquemas expuestos. No expongas `auth` ni `pg_catalog`. Obtén la **Project URL**, la clave pública **anon** (o publishable equivalente) y la clave **service_role** desde la sección de claves API. La pública sirve para el navegador con RLS; la service_role solo se usa en el servidor para enviar invitaciones.

## 2. Crear las tablas, permisos y funciones

En el SQL Editor del proyecto **nuevo**, abre una consulta y pega el contenido completo de [supabase/setup.sql](../supabase/setup.sql). Pulsa Run una sola vez. El archivo incluye las cinco migraciones, dentro de una transacción: estructura y RLS, operaciones restringidas, catálogo genérico de recetas ilustrativas. No contiene usuarios, contraseñas ni datos familiares de prueba.

Alternativa para desarrollo: aplicar por orden `supabase/migrations/*.sql` con Supabase CLI/migraciones. **Usa uno de los dos métodos**, no ambos. Si ya aplicaste la estructura, no repitas el archivo inicial. Las actualizaciones siguientes deben ser nuevas migraciones.

Opcionalmente, después de ejecutar desde el editor:

```sql
notify pgrst, 'reload schema';
```

No desactives RLS ni amplíes permisos a `anon` para resolver errores. La tabla `household_state` es privada para administradores; las consultas de cocina usan RPCs con proyecciones específicas. No hace falta habilitar Realtime: esta versión sincroniza automáticamente cada cuatro segundos y utiliza revisiones para detectar conflictos.

## 3. Configurar Auth y correos

En Authentication → configuración de usuarios/proveedores:

- Desactiva **Allow new users to sign up** / registro público.
- Mantén activo el inicio por correo y contraseña y la confirmación de correo.
- Configura una longitud mínima de contraseña de **12 caracteres** en Supabase, además de la validación de la interfaz.
- Configura **SMTP propio** (host, puerto, usuario y contraseña del proveedor, dirección remitente autorizada y nombre FamilyOS) y un remitente autorizado para enviar invitaciones y recuperación a Juan, Pamela y colaboradores. El servicio de correo predeterminado de Supabase tiene límites y restricciones de destinatarios; un fallo no se presenta como un envío exitoso. Si la respuesta de red es incierta, el estado de entrega queda sin confirmar.

En Authentication → URL Configuration:

**Site URL:**

```text
https://family-os-liard-six.vercel.app
```

**Redirect URLs**, agregadas individualmente:

```text
https://family-os-liard-six.vercel.app/auth/confirm
https://family-os-liard-six.vercel.app/auth/callback
https://family-os-liard-six.vercel.app/auth/reset-password
```

Si usas un dominio propio o un despliegue Preview, agrega sus URLs exactas y configura `NEXT_PUBLIC_APP_URL` para ese entorno. No uses comodines generales de redirección para producción.

Configura estos enlaces en las **plantillas de correo de Supabase**:

**Invite user / invitación:**

```html
<a href="{{ .SiteURL }}/auth/confirm#token_hash={{ .TokenHash }}&type=invite">Aceptar invitación a FamilyOS</a>
```

**Reset password / recuperación:**

```html
<a href="{{ .SiteURL }}/auth/confirm#token_hash={{ .TokenHash }}&type=recovery">Elegir una nueva contraseña</a>
```

El token va en el fragmento `#`, que el navegador no envía al servidor de Vercel ni en la cabecera Referer. La página lo retira de la dirección antes de verificarlo con Supabase. También se aceptan enlaces antiguos con query, con política no-referrer. Estos enlaces permiten abrir el correo en otro dispositivo y verificar el token en el cliente. No envíes ni registres URLs de invitación completas en logs o chats. Los enlaces expiran según la configuración de Auth y son de un solo uso. La invitación al hogar expira a los siete días, independientemente de la expiración del enlace de Auth.

## 4. Configurar Vercel

Abre [Vercel → proyectos](https://vercel.com/dashboard), selecciona el proyecto que publica FamilyOS y entra en Settings → Environment Variables.

| Nombre | Valor | Uso |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL de Supabase | Navegador y servidor |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública anon/publishable | Navegador; siempre sujeto a RLS |
| `NEXT_PUBLIC_SUPABASE_DB_SCHEMA` | `public` en instalación exclusiva o `familyos` en proyecto compartido | Selección del esquema de datos |
| `NEXT_PUBLIC_APP_URL` | `https://family-os-liard-six.vercel.app` | Origen autorizado y enlaces de invitación |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave service_role | **Solo servidor**, API de invitaciones |

Configura las variables para **Production**. Usa otro proyecto Supabase para Preview si quieres pruebas aisladas. No agregues prefijo `NEXT_PUBLIC_` a service_role ni la pegues en `.env.example`, documentación o GitHub.

Haz **Redeploy** después de guardar: Next.js incorpora las variables públicas durante la compilación. No basta agregarlas sin un nuevo despliegue. El SDK detecta configuración incompleta y mantiene la demo; la API de invitaciones devuelve error si faltan sus variables del servidor.

## 5. Crear las dos cuentas principales

Después de configurar Vercel y completar el Redeploy, en Authentication → Users → **Invite user**, invita a Juan y a Pamela con sus **correos reales distintos**. Cada uno abrirá su enlace y elegirá su propia contraseña. No uses Create user para asignarles una contraseña compartida ni crees cuentas para los niños.

En SQL Editor ejecuta una sola vez, sustituyendo únicamente los correos:

```sql
select public.bootstrap_household(
  'CORREO_REAL_DE_JUAN',
  'CORREO_REAL_DE_PAMELA',
  'Nuestro hogar'
);
```

La función requiere que las dos cuentas ya existan en Auth. Crea:

- Un hogar sin tareas, empleados, existencias, historial ni objetivos ficticios.
- Dos membresías principales activas, ambas con rol `admin` e iguales privilegios.
- Juan y Pamela vinculados a sus cuentas.
- Manuela y Juan de Dios como perfiles infantiles **sin cuenta de acceso**.

La app bloquea cambios de rol/desactivación de los dos principales desde la pantalla de colaboradores. La función de bootstrap no está disponible a usuarios anónimos ni autenticados; solo al SQL Editor/servicio administrativo. Si ya configuraste esas cuentas como principales, se niega a crear otro hogar por accidente.

## 6. Probar las cuentas reales

1. Abre la app publicada: debe mostrar inicio privado, no el tablero de demo. Entra con Juan.
2. En otro dispositivo/navegador, entra con Pamela. Ambos deben ver el mismo hogar, inicialmente vacío. Las recetas genéricas siguen marcadas como ilustrativas; no son datos nutricionales verificados.
3. Crea una tarea o cambia un plan con Juan. Espera el estado **Sincronizado**. Pamela debe recibir el cambio en aproximadamente cuatro segundos, o al regresar a la pestaña. Si se edita simultáneamente el mismo bloque, se muestra un conflicto, no se sobrescribe en silencio.
4. En **Usuarios y permisos**, invita un colaborador de prueba. Elige Cocina o Mantenimiento como base, ajusta sus permisos y pulsa Enviar invitación. La pantalla distingue envío confirmado, fallo, aceptación, revocación y vencimiento.
5. El colaborador acepta el correo y elige una contraseña. Cocina ve platos, ingredientes, porciones e instrucciones; **no descarga** el estado privado, metas, notas del personal ni expedientes médicos.
6. Para asignar una tarea a un colaborador, en Personal → tarea elige **Usuario con acceso a esta tarea**. El responsable operativo y el usuario autorizado son campos distintos. Las tareas antiguas sin usuario asignado no aparecen a colaboradores por coincidencia de nombre.
7. Desactiva ese colaborador desde Usuarios. Las siguientes llamadas a PostgreSQL quedan denegadas inmediatamente, aunque el token de Auth no haya expirado. La interfaz revalida la membresía cada 15 segundos. Los datos que ya vio una persona no pueden borrarse de su memoria; la protección se aplica a nuevas lecturas/escrituras.
8. Prueba Olvidé mi contraseña desde el inicio de sesión y el enlace del correo. Prueba también cerrar sesión y recargar.

No importamos automáticamente datos locales de la demo al hogar privado. `/demo` conserva datos ficticios exclusivamente en ese navegador, separada del hogar real y disponible desde el acceso privado. Los datos de negocio reales no se escriben en localStorage; solo la sesión de Supabase se conserva allí para mantener la sesión iniciada. En esta fase no hay edición privada sin conexión: los cambios pendientes deben sincronizar antes de cerrar la pantalla.

## 7. Inventario selectivo y unidades

Las carnes se controlan por defecto en **lb y oz**, con conversión exacta interna a gramos (1 lb = 16 oz = 453.59237 g). En Inventario, cada producto tiene tres modos:

- **Llevar control:** primer conteo, compras, descuentos de recetas y correcciones.
- **Siempre hay:** no requiere conteo, no se descuenta y no se agrega automáticamente al supermercado. Es el modo inicial de básicos como el aguacate.
- **Sin conteo:** puede entrar en la lista de compras si una receta lo pide, pero no exige administrar existencias.

Las selecciones se sincronizan entre administradores. Al dejar de controlar un producto, se conserva su historial. Al volver a controlarlo, se requiere un conteo nuevo para no inventar los consumos de la pausa. Las existencias explícitamente contadas en la versión anterior se conservan como productos controlados en la migración local.

## 8. Qué se ha probado y qué requiere tus credenciales

**Ejecutado localmente:** compilación de producción, TypeScript, pruebas de dominio, flujos móviles de la demo y pruebas de SQL reales en PostgreSQL embebido (PGlite), con roles `anon`/`authenticated`, identidades y hogares distintos, RLS y funciones de la migración. Incluye lecturas/escrituras de ambos administradores, revisiones en conflicto, acceso entre hogares, ocultación efectiva de datos de cocina, desactivación, invitaciones por correo confirmado, vencimiento, protección de principales, niños sin acceso y expedientes médicos denegados por defecto.

**Pruebas de navegador de Auth:** usan el SDK y una API HTTP de prueba interceptada localmente para comprobar formularios, sesión persistente, recuperación/invitación, cambio de contraseña, cierre, sincronización entre dos contextos y separación de demo. No verifican el proveedor de correo ni sustituyen una prueba de Supabase alojado.

**Pendiente externo:** configuración real de Supabase, SMTP, variables de Vercel, enlaces de correo entregados, Safari/iPhone físico y comprobación de dos dispositivos contra el proyecto alojado.

Incluimos un verificador opcional para un proyecto **de pruebas** con dos administradores, un colaborador activo y un administrador de **otro hogar**. Configura las variables `FAMILYOS_TEST_*` indicadas en `.env.example` dentro de un archivo local ignorado `.env.test.local`, además de URL/anon de ese proyecto. Ejecuta:

```sh
npm run test:live
```

Sin credenciales, termina indicando **no ejecutado**, no éxito. Por defecto verifica lecturas y aislamiento. Para probar escritura compartida, conflicto y desactivación temporal, añade `FAMILYOS_LIVE_TEST_WRITE=1` en el archivo de pruebas. El verificador agrega y retira una nota temporal y desactiva/reactiva al colaborador de prueba; no uses cuentas familiares de producción. No imprime tokens, correos, contraseñas ni datos del hogar.

## Privacidad médica y límites de esta fase

Los objetivos nutricionales viven en el estado privado de administradores. Los expedientes médicos tienen tablas y RLS aparte; **ser administrador no concede acceso médico automático**. La función `read_medical_records` exige autorización explícita por persona y registra auditoría de cada lectura. Las tablas no aceptan escrituras de clientes. No hay pantalla de expedientes, documentos privados ni mecanismo de otorgar consentimiento/tutoría en esta fase: esos datos permanecen denegados hasta diseñar ese flujo, sin concederlos a cocina.

El estado administrativo se guarda de forma progresiva en un documento JSONB por hogar con revisión atómica; las operaciones de colaboradores están limitadas a RPCs específicos. Esto conserva los módulos actuales sin reescribirlos. La normalización futura de recetas familiares, stock y tareas podrá hacerse por etapas. No hay sincronización offline ni colaboración simultánea dentro del mismo campo como un editor de documentos. La auditoría registra cambios y lecturas médicas; no copia contenido privado en los logs.

WhatsApp e IA siguen sin conectarse. Las capturas simuladas continúan etiquetadas; ninguna nota dispara mensajes, compras o acciones externas.


## Proyecto compartido (instalación autorizada)

FamilyOS puede coexistir con otra aplicación dentro del mismo proyecto gratuito. **Esto separa las tablas y la autorización del hogar, pero no crea otro servicio de Auth:** comparten identidades, contraseñas, correo, cuotas y configuración global. Un usuario de la otra aplicación no obtiene acceso a FamilyOS sin membresía activa. Las políticas de la otra aplicación siguen determinando qué recursos de ella puede leer una identidad autenticada; no se promete aislamiento completo entre servicios independientes.

1. Revisa tablas, políticas, funciones y triggers de la aplicación existente antes de cualquier instalación. Conserva una referencia de sus objetos, permisos y datos existentes.
2. En un proyecto sin esquema `familyos`, aplica **solo `supabase/shared-setup.sql`**, una vez. Se genera mediante `npm run supabase:bundle` a partir de las mismas migraciones probadas. Crea diez tablas con RLS y funciones fijadas a `familyos,pg_temp`; conserva el rol PostgreSQL `PUBLIC` en las revocaciones. No instala objetos de FamilyOS en `public`, no reemplaza funciones existentes y no aplica la revocación global de creación sobre `public`.
3. Agrega `familyos` a los esquemas expuestos de PostgREST, **preservando todos los existentes**. No concedas uso del esquema a `anon`, ni permisos de escritura directa a `authenticated`.
4. Configura `NEXT_PUBLIC_SUPABASE_DB_SCHEMA=familyos` en Vercel junto con las claves del proyecto compartido y vuelve a desplegar. El navegador, la API de invitaciones y el verificador usan ese mismo esquema. Las sesiones del navegador tienen una clave propia de FamilyOS y los cierres de sesión usan `scope: local`.
5. Conserva la configuración global de Auth de la otra aplicación, incluidos registro, contraseñas, plantillas, Site URL y triggers. Si faltan redirecciones de FamilyOS, agrégalas sin quitar las existentes. La app de FamilyOS no ofrece registro público y exige membresía; si el proyecto compartido permite crear identidades públicas para la otra app, esas identidades no tendrán acceso a los datos de FamilyOS. Si las plantillas/redirecciones actuales son incompatibles, se requiere adaptar el flujo sin romper la otra app.
6. La creación de un usuario Auth puede activar triggers existentes de perfiles de la otra aplicación. Se revisan y se preservan; esto puede generar un perfil vacío propio de esa identidad, pero no debe alterar registros de usuarios anteriores. Cambiar la contraseña de una identidad compartida afecta su acceso a ambas aplicaciones.

### Juan primero, Pamela después

No inventes un correo o usuario para Pamela. Cuando solo Juan esté invitado, realiza desde el servicio administrativo una transacción de bootstrap: comprueba su correo Auth exacto y que no tenga ya un hogar principal, crea un hogar, una membresía administrativa principal para Juan y los cuatro perfiles familiares. Pamela y los niños quedan con `user_id=null`. Inicializa con `emptyHouseholdState()` para no copiar datos ficticios de la demo. La función original `bootstrap_household` sigue disponible para instalaciones con dos usuarios reales y distintos; no la llames con un correo falso o repetido.

Cuando se disponga del correo de Pamela, invita su cuenta real y vincúlala al mismo hogar desde una operación administrativa verificada con `role=admin,is_principal=true`; enlaza su perfil familiar. Las invitaciones normales de colaboradores no elevan a administradores. No crees cuentas para los niños. Los clientes no tienen acceso a funciones de bootstrap.

Para importar mantenimiento, valida `maintenance-import.json` con `parseMaintenanceImport` y guarda el plan únicamente en el estado privado del hogar. Conserva borradores y observaciones; no inventes historial ni fechas de ejecución.

### Verificación de coexistencia

`tests/shared-schema.test.ts` instala el bundle sobre tablas/funciones `public` preexistentes y comprueba que permanezcan intactas, incluida su configuración de RLS/ACL. Prueba dos administradores sincronizados, conflictos de revisión, privacidad de cocina, usuarios de la otra app, otro hogar y anónimos, y colisiones deliberadas de nombres en `public`. Las pruebas de navegador de Auth exigen cabeceras `Accept-Profile`/`Content-Profile: familyos` y cierre de sesión local. Las comprobaciones alojadas deben usar datos ficticios temporales y eliminarlos al terminar, sin enviar correos a personas de prueba.


La migración `202610190005_sync_conflicts.sql` devuelve `PT409` (HTTP409) para revisiones antiguas. El cliente acepta también el código anterior `40001` durante la actualización; conserva el control atómico de revisión, la auditoría y los permisos. En un proyecto compartido, aplica esta actualización dirigida a `familyos` con las mismas referencias y `search_path` del bundle, nunca reemplaces una función ajena en `public`.


En instalaciones compartidas, `/auth/callback` también acepta las sesiones en fragmento `#` de las plantillas estándar de Supabase (tipos invite/recovery). Retira el fragmento antes de inicializar el cliente PKCE y verifica la sesión explícitamente; no requiere reemplazar las plantillas globales de la otra aplicación. Los enlaces PKCE y `/auth/confirm` con token hash siguen disponibles.
