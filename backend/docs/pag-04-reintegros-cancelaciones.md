# PAG-04 · Cancelaciones y reintegros

## Alcance y bloqueos

Esta etapa prepara servicios internos y un router administrativo inyectable. El router **no está montado en `app.js`**. El modelo `Admin` no tiene permisos granulares para separar cancelación, finanzas y confirmación de devoluciones; el middleware general de administrador no demuestra esa autorización específica. No habilitar estas operaciones hasta que se defina el permiso y se integre el middleware real.

Las operaciones del proveedor además requieren el entorno `test` y las compuertas `MP_REFUND_OPERATIONS_ENABLED`, `MP_ORDER_CANCELLATION_ENABLED`, `MP_ORDER_FLOW_READY` y `MP_WEBHOOKS_READY`. Todas deben permanecer falsas salvo pruebas expresamente autorizadas con credenciales aisladas. Ninguna variable de `.env` real fue inspeccionada o modificada.

## Reglas y diferencias

| Operación | Efecto |
| --- | --- |
| Cancelar pedido con pago pendiente | Cancela mediante CAR-06 y libera reservas activas una sola vez. No cambia el stock físico. |
| Cancelar order pendiente de Mercado Pago | Primero consulta y valida la order oficial; solo solicita cancelación si admite esa transición. Sin confirmación externa no libera reservas. |
| Cancelar pedido ya pagado, antes del retiro | Registra cancelación y estado financiero `EN_REVISION`; no afirma que se reintegró ni modifica stock. |
| Reintegrar dinero | Registra una solicitud independiente. No cancela automáticamente el pedido ni repone mercadería. |
| Devolución física | No se implementa aquí. Requiere recepción/inspección autorizada y un movimiento de inventario separado. |

No se inventaron plazos ni condiciones comerciales. Olla Vegana debe aprobar la política de cancelación, reintegro y recepción de devoluciones. La implementación de producción debe revisarse también frente a la normativa argentina de defensa del consumidor.

## Estados, auditoría e idempotencia

`Pedido.estadoReintegro` admite `SIN_REINTEGRO`, `PENDIENTE`, `PARCIAL`, `COMPLETO` y `EN_REVISION`. `Reintegro` conserva importes Decimal128, método, motivo, administradores, referencias del proveedor, estados intermedios, incidentes y una bitácora. Los importes se comparan en centavos enteros.

La solicitud requiere una `Idempotency-Key` estable, persistida con su huella de datos. Repetir la clave con el mismo pedido, monto y motivo devuelve la solicitud existente; reutilizarla con datos distintos produce conflicto. Las confirmaciones manuales también tienen clave y huella propias. Las actualizaciones del pedido usan `revisionReintegros` como compare-and-set dentro de transacciones MongoDB.

Las solicitudes de transferencia quedan `PENDIENTE_MANUAL`; solo una confirmación administrativa registra la devolución efectuada. Una solicitud de Mercado Pago queda pendiente de conciliación incluso cuando la API responde correctamente: no se marca completa hasta contrastar la respuesta oficial y registrar la confirmación administrativa. Timeout o respuesta ambigua se conserva como `INDETERMINADO`; solo se reintenta con la misma clave externa. No se mantiene una transacción Mongo abierta durante la llamada externa.

## Mercado Pago Orders API

La implementación usa `POST /v1/orders/{order_id}/cancel` y `POST /v1/orders/{order_id}/refund`, con `X-Idempotency-Key`. El reintegro total envía cuerpo vacío; el parcial incluye la transacción y el importe. La respuesta de creación no se toma como conciliación final. La API documenta que una order se reembolsa total o parcialmente, que se permiten varios parciales sin superar lo efectivamente pagado, y que la operación responde con estado de order y transacciones de reintegro. El código acepta la colección documentada `transactions.refunds` y exige referencia/importe/estado verificables antes de confirmar localmente. [Referencia oficial de reintegros](https://www.mercadopago.com.ar/developers/es/reference/online-payments/checkout-pro/refund-order/post), [cancelación de order](https://www.mercadopago.com.ar/developers/es/reference/online-payments/checkout-pro/cancel-order/post), [guía de cancelaciones y reintegros](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-orders/refunds-cancellations).

La llamada externa no se compensa con rollback local. Ante resultado indeterminado, la solicitud queda bloqueada para conciliación antes de nuevos intentos; la clave externa permanece igual. No se implementaron reembolsos reales ni se llamaron endpoints del proveedor.

## Inventario

La cancelación de una reserva no suma stock físico. Una devolución comercial de dinero tampoco repone unidades. Si el stock ya fue descontado por CAR-06, una restitución requiere un flujo separado de devolución física, motivo, actor, operación idempotente y movimiento `DEVOLUCION`, después de comprobar que la mercadería volvió en condiciones aceptables. Pedidos retirados quedan fuera de la cancelación simple. Esta tarea no añade una ruta para devolver stock.

## Router y permisos

`src/routes/adminOrderOperationsRoutes.js` exige autenticación y tres permisos inyectados: `authorizeOrderCancellation`, `authorizeRefundRequest` y `authorizeRefundConfirmation`. Como hoy no existe autorización financiera granular, no se conecta desde `app.js`. Cuando esté disponible, montar el router bajo `/api/admin/orders`; el actor se obtiene exclusivamente de la sesión. No aceptar estados ni IDs de administrador del cliente.

## Índices requeridos y migración

El esquema declara, con `autoIndex: false` y `autoCreate: false`:

- `uniq_reintegro_id_operacion`: `idOperacion` único.
- `uniq_reintegro_proveedor_id`: `proveedorReintegroId` único parcial cuando es string.
- `uniq_reintegro_id_confirmacion`: `idConfirmacion` único parcial cuando es string.
- `uniq_reintegro_pedido_referencia_devolucion`: combinación única parcial de pedido y referencia de devolución.
- Índices de consulta por pedido/fecha y pedido/estado.

Los servicios fallan con 503 si no comprueban los índices únicos requeridos. Declararlos en Mongoose no los crea: `assertIndexes()` solo inspecciona, nunca provisiona.

Antes de desplegar, en una base de staging respaldada: (1) exportar respaldo verificable; (2) auditar documentos existentes con campos ausentes/duplicados usando agregaciones `$group` y conteos para `idOperacion`, `idConfirmacion`, `proveedorReintegroId` y `(pedidoId, referenciaDevolucion)`; (3) resolver duplicados manualmente preservando historial; (4) revisar tipos y valores nulos respecto de filtros parciales; (5) crear cada índice explícitamente con un script operativo revisado; (6) comprobar `listIndexes()` y ejecutar pruebas de concurrencia/rollback; (7) repetir el diagnóstico y plan aprobado para producción. No hay un script que cree índices y no se conectó a MongoDB.

## Verificación y pendientes

Las pruebas unitarias usan dobles en memoria; no prueban las garantías reales de transacciones, índices ni contención concurrente. Antes de producción hacen falta MongoDB de staging con replica set, índices provisionados, permisos administrativos granulares, contrato de estados confirmado, pruebas de recuperación del proveedor y revisión operativa/legal. No ejecutar pagos, cancelaciones externas, transferencias ni cambios de inventario hasta completar esos pasos.
