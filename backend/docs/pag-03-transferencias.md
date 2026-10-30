# PAG-03: transferencias bancarias

## Implementado

- El pedido de transferencia sigue utilizando el flujo de CAR-05/CAR-06: estado inicial pendiente y reserva activa por exactamente 24 horas UTC. La fecha se calcula desde el pedido y no se crea un vencimiento de pago separado.
- `transferPaymentService` recibe confirmaciones únicamente desde la ruta administrativa protegida por `authenticate` y `authorizeAdmin`. El actor proviene de `req.admin`, nunca del cuerpo enviado por el navegador.
- El endpoint `POST /api/admin/orders/:orderId/transfer-confirmation` acepta `referencia` e `importeAcreditado`, junto con `Idempotency-Key`. Compara el importe ingresado con el total histórico del pedido en centavos enteros; la referencia y el importe quedan auditados.
- La confirmación requiere una referencia bancaria, `Idempotency-Key`, pedido de transferencia pendiente e índices previamente verificados. La llamada a `stockReservationService.confirmPayment` y el registro de auditoría comparten la transacción. CAR-06 confirma reservas y descuenta stock una sola vez; PAG-03 no implementa un segundo camino de inventario.
- Una acreditación informada después del vencimiento se registra como `TARDIA`, conserva el pago interno como pendiente, marca conciliación requerida y no llama a CAR-06 ni altera stock/reservas. No se inicia un reembolso.
- `transferInstructionsService` arma instrucciones solo desde `Configuracion` (`transferencia_alias`, `transferencia_cbu_cvu`, `transferencia_titular`, opcionalmente `transferencia_banco` y `transferencia_instrucciones`). Sin cuenta y titular configurados devuelve 503. No hay valores bancarios por defecto ni endpoint público para consultarlos.
- La consulta del comprador usa `GET /api/orders/:orderId/transfer-instructions` y un token opaco en `Authorization: Bearer`. El token se deriva con HMAC del ID de pedido y la clave de operación, se guarda en Mongo únicamente como hash y vence a los 30 días. La URL lo transporta en el fragmento `#acceso=...`, que no se envía al servidor web. La respuesta omite nombre, correo y teléfono.
- El checkout permanece en revisión: no crea pedidos, no revela datos bancarios y no afirma que se inició o completó una transferencia.

## Índices requeridos antes de activar

`ConfirmacionTransferencia` declara índices, pero `autoIndex` y `autoCreate` están desactivados y el servicio comprueba su existencia antes de operar:

- `uniq_confirmacion_transferencia_operacion`: único sobre `{ idOperacion: 1 }`.
- `uniq_confirmacion_transferencia_referencia`: único sobre `{ pedidoId: 1, referencia: 1 }`.
- `idx_confirmacion_transferencia_pedido_fecha`: consulta de auditoría por pedido y fecha.

Antes de aprovisionarlos en una base aislada, respaldar y revisar `db.confirmaciontransferencias`:

```js
db.confirmaciontransferencias.aggregate([
  { $group: { _id: '$idOperacion', cantidad: { $sum: 1 } } },
  { $match: { cantidad: { $gt: 1 } } }
])
db.confirmaciontransferencias.aggregate([
  { $group: { _id: { pedidoId: '$pedidoId', referencia: '$referencia' }, cantidad: { $sum: 1 } } },
  { $match: { cantidad: { $gt: 1 } } }
])
```

También comprobar tipos BSON y presencia de `idOperacion`, `pedidoId` y `referencia`; resolver manualmente anomalías antes de crear restricciones. En una ventana controlada, crear los dos índices únicos con los nombres indicados, añadir el índice de consulta y verificar `db.confirmaciontransferencias.getIndexes()`. No usar `syncIndexes` a ciegas. Ejecutar antes las pruebas de integración en un replica set exclusivo. No se ejecutó ni se creó ningún índice en una base real en esta tarea.

## Activación pendiente

La ruta administrativa registra una acreditación revisada por una persona autorizada; no autentica por sí misma el movimiento bancario. Antes de habilitar a compradores a pagar, hay que configurar y revisar los datos oficiales en `Configuracion`, probar sesiones/transacciones/índices y la concurrencia con MongoDB aislado, implementar la vista autorizada que muestra las instrucciones y adaptar la creación pública para que continúe bloqueada hasta esas verificaciones. No hay cron nuevo: la expiración sigue siendo responsabilidad del worker CAR-06.

La ruta pública `POST /api/orders` continúa sin montarse. El controlador preparado devuelve una respuesta acotada y una URL de instrucciones al futuro flujo de creación, pero hoy no se puede alcanzar desde el checkout. Mercado Pago conserva su flujo independiente. No se envían correos. La consulta GET solo sirve para pedidos nuevos que ya tengan el hash de acceso; los documentos históricos sin token no se pueden consultar con este mecanismo. Configurar los datos bancarios requiere completar la gestión administrativa de `Configuracion` o un procedimiento operativo autorizado.

La clave de acceso se deriva con el secreto JWT del backend mediante HKDF/HMAC y un contexto separado. Cambiar ese secreto no invalida enlaces ya emitidos porque se verifica el hash persistido, pero un reintento idempotente que necesite volver a entregar el mismo enlace después de rotar la clave no podrá regenerarlo; antes de rotaciones hay que completar las operaciones abiertas o definir versionado de claves.
