# Arquitectura de FamilyOS

La demo `/demo` sigue siendo local y no ofrece garantías multiusuario. El modo privado ya utiliza Supabase Auth, PostgreSQL con RLS y RPCs autorizados. La configuración externa se describe en `supabase-vercel.md`; Supabase alojado y SMTP aún requieren validación. Las secciones de evolución describen los módulos pendientes, no funciones ya conectadas.

## Modelo y límites

Tablas: households, memberships, people, nutrition_goals, preferences, recipes, recipe_variants, recipe_ingredients, plan_weeks, plan_slots, preparation_events, consumption_events, recipe_favorites, feedback, shopping_items, stock_observations, purchase_events, staff_profiles, routines, task_occurrences, assets, verified_manuals, maintenance_events, audit_events.

Cada fila lleva household_id. Datos nutricionales personales llevan person_id. Un evento de preparación nunca crea automáticamente un evento de consumo ni una receta favorita. Compras y observaciones de existencias son hechos distintos. Cantidades llevan unidad, estado crudo/cocido y fuente; no convertir rendimientos sin fuente verificada. Una selección conserva versión de receta y porciones para evitar alterar el pasado al editar una receta. Opiniones se asocian a persona y versión.

## Autorización

Supabase Auth verifica identidad. memberships define administrador, adulto, cocina y colaborador. RLS debe comprobar membresía en cada consulta y escritura. Cocina solo consulta una vista operativa o endpoint que entrega plato, destinatario, cantidad e instrucciones; no tiene acceso a objetivos o salud. Colaboradores solo pueden consultar tareas asignadas y los datos expresamente compartidos. Las notas del personal necesitan categoría de visibilidad y consentimiento cuando corresponda.

Datos médicos y de menores deben vivir en tablas/esquemas con permisos específicos por persona, denegación por defecto y acceso de tutores verificado; no basta una pestaña oculta. Archivos en buckets privados con URLs firmadas de corta duración y autorización previa. Nunca exponer service-role al cliente. Auditar accesos y cambios sensibles con actor, recurso, fecha y motivo, evitando copiar contenido médico a los logs. Probar RLS con usuarios de hogares distintos y cada rol antes de producción.

## Conectores

Voz: cliente captura audio solo tras permiso; servidor emite sesiones efímeras para el proveedor elegido. Transcripción y extracción producen propuestas pendientes de confirmación. Mostrar incertidumbre; conservar la fuente y solicitar datos faltantes. Nunca ejecutar instrucciones importantes solo por una transcripción ambigua.

WhatsApp Business Cloud API: webhook de servidor con validación de firma, resolución segura de remitente a miembro y aislamiento por hogar. Persistir mensajes de entrada de forma idempotente. Salida requiere aprobación explícita, actor, contenido y destinatario; cola de outbox con idempotencia. No hay conexión en esta versión.

Fotografía/OCR: subir a almacenamiento privado tras consentimiento; proveedor devuelve sugerencias con confianza, nunca cantidades o números de serie como hechos sin confirmación. Manuales necesitan URL/fuente, versión y evidencia de correspondencia de modelo. Un cron genera ocurrencias de tareas sin duplicados.

IA, correo, calendario y proveedores deben ser adaptadores independientes detrás del servidor con contratos de fuente, consentimiento y auditoría. Comparar cotizaciones solo con fuentes reales, fechadas y trazables. Credenciales en secretos del servidor. No realizar compras o enviar comunicaciones sin aprobación.

## Camino de entrega

1. Supabase, migraciones y pruebas negativas de permisos; login e invitaciones.
2. Repositorio de datos reemplaza localStorage, migración explícita de datos ficticios opcional.
3. Recetas y nutrición verificadas, disponibilidad confirmada y planificación multisemana.
4. Voz, OCR y WhatsApp con aprobación e idempotencia.
5. Módulos restantes según prioridad; salud solo después de pruebas específicas de privacidad.


## Vertical implementada: proyección y movimientos locales

`lib/meat-shopping.ts` proyecta por frecuencia de recetas preparadas por persona/tiempo y ajusta porciones teóricas de adultos con una aproximación proporcional de cuatro macros. Períodos de 10/15/30 días, margen fijo 15 %, datos incompletos explícitos. Conserva pesos escurridos separados de crudos y expone fuentes por receta/persona. Los macros de demo no son datos nutricionales verificados.

`lib/pantry.ts` utiliza movimientos aditivos: opening, purchase, preparation, correction. El primer conteo es la línea base por producto/unidad; eventos anteriores no se reaplican. El saldo desconocido es null y un saldo negativo se conserva para conciliación. La receta confirmada guarda snapshot e id; sus descuentos se agregan con el historial en una actualización funcional del estado. Los IDs de movimiento y de preparación permiten deduplicar el mismo evento. Las metas y pronósticos no modifican los consumos reales del historial.

En producción, guardar historial y movimientos dentro de una transacción PostgreSQL, con restricciones únicas por evento/ingrediente, autorización y control de concurrencia. `localStorage` no ofrece garantías entre pestañas o usuarios; no representa una implementación transaccional multiusuario. Una receta antigua sin snapshot no permite reconstruir con certeza sus cantidades pasadas; la demo no crea descuentos retroactivos. El OCR/voz debe proponer movimientos, no confirmarlos sin revisión.


## Fase multiusuario implementada

El diseño anterior se conserva en `app/components/family-app.tsx`. `AccessGate` valida usuario con Supabase Auth, acepta únicamente invitaciones de correo confirmado y obtiene membresías activas. Juan y Pamela son principales iguales. Los perfiles infantiles no se vinculan a Auth. `UserManagement` envía invitaciones mediante una ruta de servidor que verifica el JWT con `getUser`, confirma membresía administrativa y usa service_role exclusivamente para Auth Admin y estado de entrega. No hay registro público en la UI; deshabilitarlo en Supabase es parte necesaria de la configuración.

`household_state` contiene progresivamente el estado administrativo por hogar. RLS permite lectura solo a sus administradores; los clientes no tienen escritura directa. `save_household_state` verifica rol y revisión, cambia el documento y agrega auditoría. La app consulta cada 4 segundos, combina cambios en bloques distintos y muestra conflictos en el mismo bloque. No persiste datos privados ni colas offline en localStorage. El token de sesión sí se conserva mediante el SDK; cerrar sesión desmonta el hogar. La demo usa otra ruta y mantiene su almacenamiento anterior, sin importación automática al hogar real.

Los colaboradores no reciben el documento administrativo. `get_collaborator_workspace` entrega una proyección por permisos: cocina sin macros ni notas privadas; tareas solo donde `assigneeId` coincide con su identidad; activos cuando están autorizados; despensa operativa sin notas. Confirmar una preparación, registrar stock, completar una tarea o editar un activo son funciones específicas que vuelven a comprobar permisos y bloquean la fila durante la transacción. La protección no depende de la UI. La desactivación y los cambios de permisos son efectivos en la siguiente petición, aun con el token vigente.

Registros médicos y autorizaciones por persona están separados; ser administrador no concede lectura médica. No hay escrituras de cliente. `read_medical_records` exige concesión explícita y agrega auditoría de lectura; aún no se ofrece UI para otorgar esos consentimientos. Niños sin cuenta y sin permisos predeterminados. `recipes` contiene solo un catálogo global no privado; recetas familiares futuras requieren ámbito de hogar y nuevas políticas antes de añadirse ahí.

El stock usa políticas por producto (`tracked`, `always_available`, `untracked`) y una fecha de reanudación para exigir conteo fresco tras una pausa. Carnes por defecto, básicos disponibles. Entradas y presentación en lb/oz, valores canónicos en gramos, sin convertir estado crudo/cocido. Las pruebas PostgreSQL ejecutan las mismas migraciones y verifican roles, privacidad, aislamiento, conflictos, operaciones e idempotencia. Las pruebas Auth en navegador usan un contrato HTTP local, sin afirmar que SMTP ni Supabase alojado hayan sido probados.
