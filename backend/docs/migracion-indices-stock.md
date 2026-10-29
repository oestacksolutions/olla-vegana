# Índices y despliegue de CAT-05

La API usa `MovimientoStock.idOperacion` como clave idempotente. El modelo declara el índice único parcial `uniq_movimiento_id_operacion`, que excluye movimientos históricos sin esa propiedad. También desactiva `autoIndex` para este modelo: el índice no se crea automáticamente en producción.

Antes de crear el índice en una base existente:

1. Hacer un respaldo verificado de la base y probar el procedimiento sobre una copia.
2. Diagnosticar movimientos con `idOperacion` presente y duplicada, agrupando por ese campo. Resolver manualmente cualquier duplicado; no borrar ni reescribir el historial como parte de esta tarea.
3. Confirmar que los movimientos heredados sin `idOperacion` quedan fuera del índice parcial.
4. Crear de forma controlada el índice único parcial con el nombre declarado por el modelo y comprobar que quedó disponible.
5. Probar idempotencia con una base de desarrollo antes de habilitar ajustes administrativos.

Los ajustes usan una transacción MongoDB para actualizar la variante y agregar su movimiento en una sola unidad. El despliegue debe ser un replica set o clúster sharded compatible con transacciones; una instancia standalone no es suficiente. Se debe probar el nivel de compatibilidad y los índices en el entorno de desarrollo previsto.

No se ejecutó este procedimiento ni se creó ningún índice en MongoDB durante CAT-05.
