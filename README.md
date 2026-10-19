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

Las cantidades del plan y de la cocina corresponden a una porción base. La proyección de carnes, descrita más abajo, calcula factores teóricos independientes; no altera retroactivamente los ingredientes realmente descontados. Requieren revisión de un adulto, especialmente para niños y alergias. Las recetas son de demostración, no recomendaciones dietéticas. No se han validado por un nutricionista. La disponibilidad se deriva de los conteos y movimientos confirmados por el usuario; no se verifica físicamente. Sal, aceite y agua se asumen básicos. Las casillas de compras son confirmaciones del usuario, no existencias contables.

## Otros flujos

- **Personal:** agregar personas ficticias, editar notas individuales, agregar/asignar/completar tareas y cambiar frecuencia. Las rutinas se representan por su frecuencia; no se crean ocurrencias ni avisos automáticos.
- **Casa:** agregar activos, editar ficha y consultar tareas. Modelos, números de serie y manuales no se infieren. No se afirman mantenimientos basados en manuales sin verificarlos.
- **Captura:** voz y WhatsApp son entradas de texto etiquetadas como simulación; foto permite seleccionar un archivo pero no lo transmite, analiza ni conserva. La descripción confirmada se registra en la bandeja local. Una nota no ejecuta una acción.
- Niños, vehículos, experiencias, documentos y salud son navegación a prototipos, identificados como tales.

## Pruebas

```sh
npm test
npm run typecheck
npm run build
# Con el servidor activo en otro terminal:
CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e
```

Playwright usa Chromium de sistema por defecto; indicar `CHROMIUM_PATH` si está en otra ubicación. Alternativa: instalar Chromium con Playwright y configurar su ejecutable. Las pruebas de navegador usan tamaño iPhone en Chromium; no equivalen a pruebas en Safari o un iPhone físico. Cubren asignación independiente, compras, historial, recetario, recarga, modo infantil, tareas, activos, captura, inventario inicial, compras de despensa, descuentos de recetas, correcciones, productos nuevos, proyección de carnes 10/15/30 días, margen, existencias y ausencia de desbordamiento horizontal.

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

Autenticación y sincronización; personalización nutricional validada con cantidades según objetivos, alergias y disponibilidad; ingesta real; semanas futuras; recetas propias y variantes; conciliación automática de facturas; recordatorios reales; manuales verificados; voz real; OCR; WhatsApp Business; roles de cocina separados; documentos y salud. No se hacen compras ni se envían mensajes. No se almacenan credenciales.

## Criterios de aceptación de esta versión

- Inicio y navegación utilizables en móvil y escritorio.
- Cuatro perfiles independientes, modo infantil sin metas calóricas, 10 opciones por tiempo.
- Asignación de una semana de muestra, porciones base, lista agregada, receta operativa, confirmación e historial con opiniones, recetario explícito.
- Personal y activos editables, tareas asignables y confirmables, frecuencias visibles.
- Capturas simuladas honestas y persistencia tras recargar.
- Compilación, pruebas de dominio y flujos de navegador verificables sin servicios externos.


## Carnes y despensa

En **Nutrición → Compras**, la sección Carnes proyecta compras para **10 días, 15 días o un mes de 30 días**, por tipo de carne. Usa el historial completo de preparaciones por persona y tiempo, incluidas recetas vegetarianas para determinar la mezcla. No usa favoritos ni interpreta preparaciones como consumo. El plan semanal se muestra aparte y **no debe sumarse** a esta proyección.

Para Juan y Pamela, un factor proporcional aproxima los cuatro objetivos (calorías, proteína, carbohidratos y grasa), suponiendo un reparto diario de 25 % desayuno, 40 % almuerzo y 35 % cena. Se minimiza la suma del error relativo cuadrático entre la receta escalada y cada meta del tiempo: si `r_i = macro_receta_i / meta_tiempo_i`, el factor es `sum(r_i) / sum(r_i²)`. Se escalan todos los ingredientes de la receta de forma uniforme; una sola proporción no puede garantizar cuatro metas independientes. No se prescribe ni cambia una dieta. Los niños usan una porción base sin consultar objetivos nutricionales.

La fórmula de cada ingrediente es: gramos base × factor × frecuencia entre preparaciones del mismo tiempo/persona × días. Se agrega a todas las personas y se aplica **15 % de seguridad una sola vez**. Después se descuentan las existencias registradas, nunca más de lo requerido. El resultado se redondea hacia arriba al gramo y se muestra en libras aproximadas y kg. Los macros del catálogo siguen siendo **datos ilustrativos de la demo**, no verificados para compras o decisiones nutricionales reales. Las metas ausentes, cero o inválidas excluyen esa parte con aviso; no se inventan. Los tiempos sin historial se identifican explícitamente como cobertura faltante. No se completa el resto del día por inferencia.

En **Inventario** o **Nutrición → Despensa**:

1. Seleccionar un producto y guardar su primer conteo. Para productos fuera del catálogo, elegir **Otro producto**, indicar nombre y unidad. Confirmar 0 cuando realmente no haya.
2. Registrar compras posteriores: cantidad añadida, no saldo total. Sin inventario inicial de ese producto, primero se requiere el conteo.
3. Confirmar una preparación en Cocina: guarda historial y movimientos de los ingredientes de **una porción base**, en una única actualización del estado local. Cada persona preparada se confirma una vez. No se descuenta al planificar, proyectar o guardar una nota de voz/foto.
4. Ver existencias: inicial + compras − recetas + correcciones. Los consumos sin conteo inicial se conservan como movimientos pero el saldo permanece **sin conteo**. El primer conteo refleja todo lo anterior: los eventos antiguos no se vuelven a restar.
5. Si el saldo no coincide, usar **Corregir conteo** e indicar cuánto hay ahora. La diferencia se conserva como ajuste; nunca se borra el historial de compras.

Un saldo negativo se muestra para conciliarlo, sin ocultarlo ni asumir disponibilidad. No se convierten unidades o pesos crudos/cocidos/escurridos. El atún se calcula como peso escurrido, sin inventar número de latas. Las nuevas preparaciones conservan una copia de su receta; los registros antiguos se asocian por identificador o nombre exacto al catálogo actual y se explicita esa limitación. El motor impide repetir los movimientos del mismo evento de preparación. Confirmar otra vez con un evento nuevo representa otra porción y vuelve a descontar: es responsabilidad del usuario confirmar solo lo que se preparó.

Compras reales, facturas, voz y fotografías no se verifican ni procesan automáticamente. El saldo es una estimación operativa basada en entradas confirmadas; no un conteo físico continuo. Registrar mermas o cambios de receta mediante correcciones. Toda la información sigue siendo local al navegador y sin sincronización.

La lista semanal también descuenta existencias conocidas por producto/unidad y muestra el faltante. Marcar una casilla no confirma una compra; para aumentar existencias se registra la compra en Despensa.
