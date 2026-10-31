# PAG-02 · Webhooks de Mercado Pago Orders API

## Flujo preparado

`POST /api/webhooks/mercadopago` recibe notificaciones del tópico `order`. No usa JWT: valida `x-signature`, `x-request-id`, `data.id` del query y el ID coincidente del body. El JSON global de Express se limita a 10 KB. No se registran firmas, tokens ni cuerpos.

La firma se valida con `WebhookSignatureValidator` del SDK oficial. Se exige `ts` y `v1` únicos, timestamp de 10 o 13 dígitos dentro de cinco minutos, request ID y order ID válidos. El SDK verifica HMAC-SHA256 en tiempo constante. Se usa literalmente el `data.id` de la query; valores ambiguos se rechazan.

La notificación no prueba un pago. El servicio consulta exclusivamente `GET https://api.mercadopago.com/v1/orders/{order_id}` con Bearer backend, timeout de cuatro segundos y un reintento limitado para fallos transitorios. Verifica aplicación, ID de cuenta vendedora (`MP_USER_ID`) tanto en la notificación como en la order consultada, ambiente de prueba, order `online/manual`, referencia `OV-{numero}`, importe histórico, ARS y los pagos informados por la respuesta oficial.

## Estados y aplicación

| Orders API | Tratamiento interno |
| --- | --- |
| `processed/accredited`, total y pagos acreditados coincidentes | Confirma mediante `stockReservationService.confirmPayment`, dentro de la misma transacción que actualiza intento y evento. |
| `created`, `processing`, `action_required`, sin importe acreditado | Registra estado; no cambia pago ni inventario. |
| `failed` o `canceled`, sin pago acreditado | Rechaza el pago Mercado Pago y libera reservas con el servicio existente. |
| Reembolso, monto parcial, moneda discordante o estado no reconocido | Conserva evento e intento para revisión; no descuenta ni libera stock por inferencia. |

Una acreditación oficial cuyo pedido ya no tenga reservas confirmables conserva el hecho financiero (`APROBADO`, IDs/fechas y nota de conciliación), sin reactivar reservas ni descontar inventario. El intento y el evento señalan `ACREDITACION_SIN_RESERVA`. Las transferencias no pasan por este flujo.

Los cambios locales del evento, intento, pedido, reservas y movimientos de venta son transaccionales. La consulta a Mercado Pago ocurre fuera de la transacción. Se reutilizan las claves deterministas e índices de CAR-06. Fallos externos/de persistencia responden 503; un evento se responde 200 solo cuando quedó procesado, guardado para revisión/no-aplica o reconocido como duplicado.

La idempotencia de entrega es SHA-256 de order ID y snapshot de estado oficial en `EventoPago.idempotencia`. Una repetición del mismo estado se reconoce y una actualización legítima crea otro evento. `orderExternaId` enlaza el intento; no identifica individualmente una notificación.

## Compuertas

Los valores de ejemplo `MP_WEBHOOK_EFFECTS_ENABLED=false`, `MP_ORDER_CREATION_ENABLED=false`, `MP_ORDER_FLOW_READY=false` y `MP_WEBHOOKS_READY=false` mantienen los efectos cerrados. Se requiere además `MP_ENVIRONMENT=test`, credenciales de servidor, application ID y colaboradores. La ruta puede recibir notificaciones, pero la configuración predeterminada no aplica efectos financieros/de inventario. `/api/orders` sigue deshabilitado.

Variables nuevas en `.env.example`: `MP_APPLICATION_ID`, `MP_USER_ID` y `MP_WEBHOOK_EFFECTS_ENABLED`. `MP_ACCESS_TOKEN` y `MP_WEBHOOK_SECRET` son solo backend; el secreto de firma es distinto del token.

## Índices requeridos y procedimiento futuro

- `EventoPago.uniq_evento_pago_idempotencia`: único parcial `{ idempotencia: 1 }` para strings; eventos heredados sin clave quedan fuera.
- `IntentoPago.uniq_intento_pago_order_externa`: único parcial `{ orderExternaId: 1 }` para strings.
- `IntentoPago.uniq_intento_pago_idempotencia`: único `{ proveedor: 1, claveIdempotencia: 1 }`.
- Se requieren también índices de CAR-05/CAR-06: número y operación del pedido, `{ pedidoId, varianteId }` de reserva y `MovimientoStock.idOperacion` parcial único.

Antes de provisionarlos: hacer respaldo probado; ensayar en una copia aislada; diagnosticar duplicados y tipos nulos/ausentes; no borrar ni escoger duplicados automáticamente; resolverlos manualmente; provisionar en ventana controlada; verificar por `listIndexes()` nombre, claves, `unique` y filtro parcial; ejecutar pruebas concurrentes y rollback sobre un replica set aislado. La aplicación desactiva `autoIndex`/`autoCreate` y solo inspecciona índices. No se crearon índices ni se conectó a MongoDB en esta tarea.

## Dependencias y límites

- No se implementan reembolsos, contracargos ni conciliación automática; requieren revisión manual.
- No existe worker de recuperación independiente. Eventos quedan `RECIBIDO` antes de la transacción y se pueden reprocesar en retransmisiones. Para recuperarse aunque no llegue otra notificación se necesita un worker durable.
- Firma, formato real de IDs, estados y respuestas deben verificarse con credenciales de prueba y MongoDB aislado antes de habilitar flags o registrar URL pública.
