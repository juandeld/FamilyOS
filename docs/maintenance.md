# Mantenimiento: del archivo a una operación sencilla

## Uso

En **Casa** se encuentran Agenda, Plan base, Materiales e Historial. El ejemplo público contiene rutinas genéricas ficticias, no los detalles del archivo familiar. Cargarlo no activa trabajos ni inventa ejecuciones.

1. Revisa el plan base y sus observaciones. Configura responsable y acceso a tareas una sola vez.
2. Elige la fecha de inicio y activa las rutinas listas. Los borradores con observaciones permanecen sin activar.
3. Confirma únicamente trabajos realizados. Una confirmación registra fecha prevista, fecha realizada, notas y costo opcional en GTQ; calcula la próxima fecha y prepara una nueva tarea. Los períodos omitidos no se marcan como completados.
4. Pausar detiene las tareas pendientes de la rutina; mantiene las confirmaciones anteriores. Reanudar recupera la siguiente fecha registrada, incluso si está pendiente, sin fingir ejecuciones durante la pausa.
5. Consulta materiales para el mes elegido. Se distinguen insumos por validar de insumos confirmados para preparar; no equivalen a existencias ni compras. No se suman cantidades de unidades desconocidas o envases sin volumen definido.

El día del mes permanece anclado: una rutina del día 31 pasa al último día de febrero y vuelve al 31 en marzo. Las recurrencias semanales conservan su ciclo; las completadas tarde generan la próxima fecha futura sin crear un historial ficticio. Las fechas de ejecución usan America/Guatemala. No se envían avisos, mensajes ni pedidos externos.

## Preparar un archivo histórico

El convertidor offline es específico para la estructura del archivo legado (hoja Tabla, con hojas complementarias). Requiere Python y openpyxl:

```sh
python scripts/prepare-maintenance-import.py /ruta/archivo.xlsx /ruta/privada/fuera-del-repositorio
```

Produce un Excel depurado, un análisis y `maintenance-import.json`. Conserva referencias de filas, materiales y códigos técnicos; señala contradicciones, separa proveedores históricos de insumos, no infiere propietarios ni responsabilidades actuales y trata como desconocidas las horas vacías o cero. Las pinturas se proponen como inspección por condición; las instrucciones técnicas o productos antiguos no se dan por verificados.

**Nunca agregues el archivo original ni los resultados privados a GitHub o a public/.** En un hogar autenticado, un administrador puede importar el JSON preparado, revisar el resumen y confirmar. La validación rechaza historiales prellenados, IDs repetidos, tareas ya activadas o usuarios preasignados. No reemplaza un plan existente y preserva cocina, inventario y tareas ajenas a mantenimiento.

## Persistencia y permisos

`maintenance` forma parte del estado administrativo privado por hogar y participa en el control de revisiones existente. Las tareas recurrentes se vinculan por ID estable de rutina y fecha. Solo el administrador configura el plan. Un colaborador con `tasks.read` consulta sus instrucciones y fechas mediante `get_maintenance_tasks`; la función no devuelve el archivo, notas del importador, referencias privadas, costos ni historial. `set_my_task_done` requiere `tasks.update` y asignación al usuario, confirma y crea la siguiente tarea en una transacción, con auditoría y protección ante repetición.

Para un **proyecto FamilyOS ya instalado**, aplica únicamente `supabase/migrations/202610190004_maintenance.sql`. Para un proyecto FamilyOS nuevo y exclusivo, `supabase/setup.sql` incluye la instalación completa. No se aplica sobre proyectos de otras aplicaciones. El despliegue de código no ejecuta migraciones automáticamente.

## Situación de la conexión

El proyecto Supabase previamente conectado pertenece a otra aplicación, según confirmó el usuario. Se retiraron únicamente las variables de esa conexión en el proyecto Vercel de FamilyOS. La otra base no se modificó. FamilyOS necesita su propio proyecto y las variables documentadas en `docs/supabase-vercel.md` para habilitar cuentas privadas y sincronización. Mientras tanto, el módulo se puede probar con datos ficticios locales; el archivo familiar queda preparado fuera del repositorio para una importación privada posterior.
