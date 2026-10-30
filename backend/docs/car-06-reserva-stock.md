# CAR-06 · Reservas de inventario

## Estado seguro de habilitación

La lógica de dominio quedó preparada, pero la creación pública sigue deshabilitada: `POST /api/orders` no se monta en `src/app.js` y `orderRoutes.js` responde 503 sin llamar a persistencia. No habilitarla hasta verificar transacciones, índices y concurrencia en la base aislada `olla_vegana_car05_test` (o un entorno dedicado equivalente). No se conectó a MongoDB durante esta tarea.

## Creación de pedido y reserva

`orderService.createOrder` vuelve a validar carrito y retiro dentro de la misma sesión MongoDB usada para crear pedido, ítems, estado inicial y reservas. Solo admite `TRANSFERENCIA` por ahora. La fecha de creación y vencimiento se fijan juntas en UTC; `venceEn` es exactamente `creadoEn + 24 horas`. Mercado Pago devuelve 503 desde el servicio hasta definir una política completa de vencimiento; no se le aplica el plazo de transferencia.

La reserva no decrementa `Variante.stock`. Antes de leer las reservas vigentes, `stockReservationService` aplica un compare-and-set sobre `Variante.revisionReservas`, que actúa como punto de serialización de todas las reservas/confirmaciones de esa variante. La transacción consulta las reservas activas, calcula disponibilidad con `calculateStockAvailability`, y agrega la reserva. Solicitudes concurrentes sobre la misma variante compiten por el mismo documento; los conflictos reintentan la transacción para volver a calcular disponibilidad. Variantes en un carrito se procesan en orden determinista.

Los documentos heredados pueden no tener `revisionReservas`: el primer compare-and-set condiciona la escritura a que el campo aún no exista y lo inicializa atómicamente. No requiere backfill. `revisionReservas` no es stock ni afecta el catálogo.

## Confirmación, cancelación y vencimiento

- `confirmPayment` no tiene endpoint. Requiere un verificador inyectado que confirme una acreditación confiable; el valor del cliente no basta. En una transacción descuenta el stock físico una sola vez, crea un movimiento `VENTA` idempotente, convierte las reservas activas en `CONFIRMADA` y marca el pago aprobado. Así, dejar de contar la reserva y reducir el stock físico conserva la disponibilidad.
- `cancelOrder` libera reservas activas y cambia el estado del pedido a `CANCELADO` en una transacción. No aumenta stock físico.
- `expireDueReservations` es una función recuperable para un worker/cron futuro, actualmente no programada. Procesa pedidos vencidos por transacción; solo cancela pagos pendientes y libera reservas una vez. No elimina historial ni usa TTL.
- Una operación concurrente de confirmación, cancelación y expiración comparte escrituras condicionales sobre pedido/reservas/variante. El estado final se decide al confirmar la transacción; no se duplica el débito físico.

No se implementaron webhooks, pagos, rutas administrativas de pago ni cron productivo. El verificador de acreditación debe ser proporcionado por una futura integración autorizada.

## Índices requeridos y preparación controlada

La conexión Mongoose ahora usa `autoCreate: false` y `autoIndex: false`; el modelo `ReservaStock` también desactiva creación automática de índices. No se creó ningún índice en Atlas. Antes de habilitar pedidos, en una copia de seguridad y un entorno aislado:

1. Revisar reservas existentes y diagnosticar duplicados por `{ pedidoId, varianteId }` con una agregación `$group`; revisar estados, cantidades, pedidos correspondientes y vencimientos. No borrar ni consolidar automáticamente.
2. Confirmar que el índice único exista con nombre `uniq_reserva_pedido_variante`, claves `{ pedidoId: 1, varianteId: 1 }`. Si hay duplicados, resolverlos con el responsable de datos antes de crear el índice.
3. Confirmar `Pedido.uniq_pedido_numero` y el índice parcial `uniq_pedido_id_operacion` ya requerido por CAR-05.
4. Antes de habilitar confirmación de pagos, comprobar el índice único parcial `MovimientoStock.uniq_movimiento_id_operacion` (`{ idOperacion: 1 }`, filtro `{ idOperacion: { $type: 'string' } }`). Diagnosticar duplicados previamente.
5. Aprovisionar índices mediante un procedimiento revisado y explícito, nunca al arrancar el servidor; verificar `listIndexes()` y ejecutar concurrencia/rollback en una base replica-set aislada.

Los índices de consulta de vencimientos (`idx_reserva_estado_vencimiento` e `idx_reserva_variante_estado_vencimiento`) mejoran el worker, pero no sustituyen la unicidad ni el compare-and-set. Deben provisionarse también de forma controlada. La transacción requiere replica set o clúster compatible; standalone MongoDB no es suficiente.

## Pruebas

Las pruebas unitarias usan dobles y no acceden a MongoDB. La suite de persistencia/concurrencia se ejecuta con `npm run test:integration:orders` solo cuando se configura `MONGODB_CAR05_TEST_URI` para la base exclusiva `olla_vegana_car05_test` y `CAR05_TEST_DATABASE_ISOLATED=1`. Esa suite crea colecciones aleatorias efímeras y provisiona índices únicamente en ellas; no reutilizar URI de desarrollo o producción. Hasta ejecutarla en un replica set aislado, concurrencia, índices reales y rollback de MongoDB permanecen sin aprobar.
