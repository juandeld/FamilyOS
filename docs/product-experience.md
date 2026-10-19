# LT Living: dirección de producto

La identidad LT sigue vigente: monograma Cormorant Light, terracota, carbón y bases cálidas. La instrucción posterior del usuario es explícita: **la aplicación no debe ser una aplicación literal del manual gráfico ni verse plana**. Las restricciones originales de ausencia total de sombras, composición casi monocroma y tipografía extremadamente ligera se reemplazan por jerarquía, fotografía ambiental, superficies con profundidad, contrastes y controles legibles.

El rediseño conserva los datos y permisos existentes. `app/experience.css` extiende el sistema anterior sin reescribir los módulos; `HomeDashboard` compone accesos, planificación y tareas desde el estado existente. La navegación móvil fija facilita Inicio, Cocina, voz simulada, Equipo y el resto de módulos. Los controles anteriores continúan disponibles en el menú completo. Cerrar un pendiente desde el inicio actualiza exactamente la misma tarea que el módulo Equipo.

Las imágenes en `public/images` son ilustraciones fotográficas generadas para esta interfaz: no son fotografías de la casa real, de la familia ni de preparaciones confirmadas. Las tarjetas indican que las imágenes son ilustrativas; nunca constituyen historial ni prueba de consumo. Las imágenes se sirven localmente, optimizadas en WebP. No se añadieron servicios de IA o conexiones en tiempo de ejecución.

`/prueba` mantiene la entrada temporal **0000** a datos ficticios, separada del acceso privado. La autenticación y los permisos no cambiaron.
