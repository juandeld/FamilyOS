# FamilyOS

Un hogar en armonía. Vertical slice móvil para un hogar en Guatemala, con datos ficticios y persistencia local. Next.js App Router, TypeScript, Tailwind CSS 4 y Lucide. No requiere credenciales ni servicios externos.

## Ejecutar

Node.js 22 o 24 LTS y npm. En `/workspace/FamilyOS` (o la carpeta donde clones el repositorio):

```sh
npm ci
npm run dev
```

Producción local: `npm run build` y `npm start`. El servidor escucha en todas las interfaces en el puerto 3000. Variables opcionales documentadas en `.env.example`; **no son necesarias ni se utilizan en esta demo**.

## Probar el ciclo de cocina

1. Abrir Nutrición → Plan semanal. Elegir Juan, día y tiempo. Hay diez platos base por tiempo.
2. Elegir un plato; cambiar a Pamela o a un niño y elegir otro. Cada combinación persona/día/tiempo es independiente. Elegir nuevamente reemplaza la selección.
3. En Perfiles, editar objetivos individuales de Juan/Pamela y gustos de cualquiera. Los niños no tienen campos de calorías o macros. Los gustos y opiniones ordenan las propuestas mediante una regla local, no IA. **Los objetivos no recalculan las recetas ni sus porciones**.
4. En Compras, consultar ingredientes agregados de las porciones planificadas y marcar lo que ya tienes. Las marcas se guardan. No hay conteo diario ni compra automática.
5. En Cocina, leer cantidades crudas salvo ingredientes explícitamente cocidos y las instrucciones base. Confirmar una preparación para registrarla. Puede confirmarse otra preparación del mismo plato; cada confirmación es un evento distinto.
6. En Historial, registrar una opinión por persona. Preparación no implica consumo. Los macros mostrados son **ilustrativos planificados**, no un registro de ingesta real.
7. Guardar expresamente un plato con el icono de libro para incluirlo en Recetario. Historial y recetario son colecciones separadas.
8. Recargar: datos preservados en este navegador.

Las cantidades corresponden a una porción base. Requieren revisión de un adulto, especialmente para niños y alergias. Las recetas son de demostración, no recomendaciones dietéticas. No se han validado por un nutricionista. Disponibilidad actual no verificada. Sal, aceite y agua se asumen básicos. Las casillas de compras son confirmaciones del usuario, no existencias contables.

## Otros flujos

- **Personal:** agregar personas ficticias, editar notas individuales, agregar/asignar/completar tareas y cambiar frecuencia. Las rutinas se representan por su frecuencia; no se crean ocurrencias ni avisos automáticos.
- **Casa:** agregar activos, editar ficha y consultar tareas. Modelos, números de serie y manuales no se infieren. No se afirman mantenimientos basados en manuales sin verificarlos.
- **Captura:** voz y WhatsApp son entradas de texto etiquetadas como simulación; foto permite seleccionar un archivo pero no lo transmite, analiza ni conserva. La descripción confirmada se registra en la bandeja local. Una nota no ejecuta una acción.
- Inventario, niños, vehículos, experiencias, documentos y salud son navegación a prototipos, identificados como tales.

## Pruebas

```sh
npm test
npm run typecheck
npm run build
# Con el servidor activo en otro terminal:
CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e
```

Playwright usa Chromium de sistema por defecto; indicar `CHROMIUM_PATH` si está en otra ubicación. Alternativa: instalar Chromium con Playwright y configurar su ejecutable. Las pruebas de navegador usan tamaño iPhone en Chromium; no equivalen a pruebas en Safari o un iPhone físico. Cubren asignación independiente, agregación de compras, historial, recetario, recarga, modo infantil, tareas, activos, captura y ausencia de desbordamiento horizontal en inicio.

## iPhone y PWA

Servir en un origen **HTTPS accesible por el teléfono**, por ejemplo desplegando este repositorio en Vercel con preset Next.js. El despliegue no está realizado ni conectado por esta demo. Abrir esa URL en Safari → Compartir → Agregar a pantalla de inicio. Incluye manifest, iconos PNG, metadatos Apple y service worker con caché básica de la interfaz después de una visita completa. Las funcionalidades de PWA requieren HTTPS (salvo excepciones locales de desarrollo). El caché no es una garantía de funcionamiento offline completo ni de recuperación de datos.

Para desarrollo en red local, se puede usar la IP LAN de la computadora y el puerto 3000 si la red/firewall lo permiten; para instalación y service worker se necesita HTTPS. No usar una dirección loopback en el teléfono para llegar a la computadora.

## Arquitectura y evolución

- `app/page.tsx`: vista móvil y flujos de la demo; `app/globals.css`: sistema visual cálido con verde salvia, crema y tipografía editorial.
- `lib/domain.ts`, `lib/catalog.ts`: catálogo de 30 recetas, estado, claves de planificación, lista agregada y ordenación local por preferencias/opiniones.
- `lib/connectors.ts`: contratos desacoplados para voz, WhatsApp, foto y repositorio. Ninguno se conecta a un proveedor.
- `localStorage`, clave `familyos-v1`: almacenamiento **por origen, dispositivo y navegador**, sin cifrado de aplicación ni respaldo. Para reiniciar la demo, eliminar esta clave desde las herramientas del navegador. No guardar información real, médica o documentos.
- Propuesta de producción: Supabase Auth, PostgreSQL con RLS y Storage privado. Ver `docs/architecture.md`. No se han implementado ni probado autenticación, roles efectivos, auditoría ni separación segura entre usuarios. La vista Cocina es una simplificación visual, **no un límite de seguridad**.

## Pendiente explícito

Autenticación y sincronización; personalización nutricional validada con cantidades según objetivos, alergias y disponibilidad; ingesta real; semanas futuras; recetas propias y variantes; inventario conciliado; recordatorios reales; manuales verificados; voz real; OCR; WhatsApp Business; roles de cocina separados; documentos y salud. No se hacen compras ni se envían mensajes. No se almacenan credenciales.

## Criterios de aceptación de esta versión

- Inicio y navegación utilizables en móvil y escritorio.
- Cuatro perfiles independientes, modo infantil sin metas calóricas, 10 opciones por tiempo.
- Asignación de una semana de muestra, porciones base, lista agregada, receta operativa, confirmación e historial con opiniones, recetario explícito.
- Personal y activos editables, tareas asignables y confirmables, frecuencias visibles.
- Capturas simuladas honestas y persistencia tras recargar.
- Compilación, pruebas de dominio y flujos de navegador verificables sin servicios externos.
