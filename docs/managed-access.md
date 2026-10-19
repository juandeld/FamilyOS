# Google para administradores; usuarios creados para el equipo

El modo de acceso administrado se activa con `NEXT_PUBLIC_FAMILYOS_MANAGED_ACCESS=true`. La demo en `/prueba` y `/demo` permanece independiente. No hay registro público de usuarios de FamilyOS.

## Experiencia

- El administrador entra con Google usando una cuenta aprobada explícitamente para el hogar.
- En Usuarios y permisos crea cada colaborador con nombre, usuario, contraseña inicial de al menos 12 caracteres y permisos. Cocina y Mantenimiento ofrecen configuraciones iniciales editables.
- El colaborador entra en **Equipo de casa** con su usuario y contraseña. No necesita correo personal ni recibe invitaciones por email.
- El administrador puede desactivar, ajustar permisos o restablecer la contraseña. Los cambios de acceso y el restablecimiento invalidan las sesiones anteriores del colaborador en las reglas de PostgreSQL; no dependen de ocultar pantallas.
- Las contraseñas no se almacenan en el estado familiar, notas, auditoría ni tablas de la aplicación. Supabase Auth almacena sus credenciales. El administrador comparte la contraseña inicial personalmente.

## Separación y privacidad

Supabase Auth utiliza internamente una identidad técnica opaca bajo el dominio reservado `.invalid` para los colaboradores. Ese identificador no representa un correo humano, no se usa para enviar mensajes y no se muestra en el formulario. No es un secreto; la autorización siempre depende de membresía, permisos y sesión vigente.

La relación entre usuario y cuenta Auth, las aprobaciones administrativas y los contadores de acceso quedan en tablas privadas con RLS, accesibles únicamente a las operaciones autorizadas del servidor. Los intentos de login tienen límites persistentes por usuario y dirección de red; si el control no está disponible, el acceso falla sin permitir saltárselo. Los errores de usuario inexistente y contraseña incorrecta comparten el mismo mensaje.

Se aplica la migración `202610190006_managed_access.sql` al esquema de instalación. En un proyecto compartido se dirige a `familyos`, conservando `public`, los triggers y las identidades de la otra aplicación. Las nuevas identidades Auth pueden activar el trigger ya existente de perfiles propios de esa otra aplicación. Los administradores y sus permisos principales no se modifican desde operaciones de colaboradores.

## Configurar Google en el proyecto compartido

Google está inicialmente desactivado. FamilyOS consulta la configuración pública del proveedor y no muestra el botón como funcional hasta que esté habilitado. El acceso previo se conserva durante la preparación; no se exige Google hasta completar la primera sesión real aprobada.

1. Abre [Google Auth Platform → Clients](https://console.cloud.google.com/auth/clients). Selecciona o crea el proyecto de Google Cloud destinado a FamilyOS y configura su pantalla de consentimiento. Durante pruebas, agrega como usuario de prueba la cuenta administrativa autorizada. Solicita solo `openid`, `email` y `profile`.
2. Crea un cliente OAuth de tipo **Web application**. El origen de JavaScript es el dominio de FamilyOS. La redirección autorizada de Google es `https://<PROJECT_REF>.supabase.co/auth/v1/callback`, no la ruta de Vercel.
3. En Supabase → Authentication → Sign In / Providers → Google, guarda el Client ID y Client Secret directamente en el proveedor. Nunca los agregues a GitHub ni al chat. Habilita únicamente Google sin modificar otros proveedores, contraseñas, plantillas ni el registro global de la otra aplicación.
4. Agrega la URL exacta `https://<FAMILYOS_DOMAIN>/auth/google` a las redirecciones permitidas de Supabase, preservando las existentes.
5. Con registro global desactivado, prepara desde el servicio administrativo la identidad Auth de la cuenta Google autorizada, sin contraseña compartida ni envío de invitaciones. Agrega una aprobación explícita en `google_admin_approvals` para ese correo y el hogar correcto; vincula `legacy_user_id` solo si se trata de la migración de un administrador existente. No hay aprobación automática por utilizar Gmail o por conocer la URL.
6. Entra con esa cuenta desde **Continuar con Google**. El flujo PKCE verifica la sesión, y `claim_google_principal` valida el correo confirmado, la identidad Google y una autenticación OAuth. Solo después activa la exigencia de Google, vincula el perfil familiar y desactiva la membresía anterior del mismo administrador. Conserva datos, hogar y auditoría. Una cuenta Google no aprobada nunca se convierte en administrador.

OAuth AMR distingue OAuth de contraseña, pero no nombra al proveedor. La regla exige además una identidad Google verificada y rechaza identidades con otros proveedores externos vinculados hasta revisarlas. No confía en el texto de un formulario ni solo en `app_metadata.provider`. El cambio de proveedor no modifica los permisos médicos.

## Pruebas y límites

Las pruebas SQL comprueban el requisito real de Google, aprobaciones, sesiones anteriores tras restablecimiento, separación por hogar, límites de intentos y protección de los principales. Las pruebas de API comprueban autorización, errores parciales e idempotencia. El navegador utiliza un proveedor simulado para verificar los flujos de interfaz; no equivale a completar Google OAuth real. Se requiere probar con el Client ID y Client Secret reales antes de declarar activo el acceso con Google.

Ejecuta `npm test`, `npm run test:auth`, `npm run test:managed` y `npm run test:e2e` para verificar dominio, permisos y flujos de navegador. Las credenciales externas de Google se configuran en Supabase, no en estas pruebas.
