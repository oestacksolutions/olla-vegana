# PAG-01 · Mercado Pago Checkout Pro con Orders API

## Alcance y bloqueo actual

Se preparó un cliente interno para `POST https://api.mercadopago.com/v1/orders`, un modelo separado `IntentoPago` y el armado de páginas de retorno. No hay ruta pública de creación de operaciones, no se llama a Mercado Pago desde el checkout y `POST /api/orders` continúa sin montarse (el router existente responde 503). La compra real permanece bloqueada.

El servicio interno exige simultáneamente `MP_ENVIRONMENT=test`, `MP_ORDER_CREATION_ENABLED=true`, `MP_ORDER_FLOW_READY=true`, `MP_WEBHOOKS_READY=true`, token y URL pública válidos. Los tres flags son falsos por defecto. Esta compuerta no habilita por sí misma pedidos públicos; la creación de pedidos continúa bloqueada aparte.

## Payload y datos de confianza

El payload se construye desde `Pedido` y `ItemPedido` persistidos. Usa `Pedido.total`, `Pedido.numero`, `Pedido.correo`, y snapshots históricos de precio, cantidad, nombre y variante. Los importes se procesan como centavos `BigInt`, se valida que cada subtotal y la suma coincidan, y se envían como decimales en texto. No se toma monto, email, referencia, nombre ni estado del navegador.

El cliente envía `type: online`, `processing_mode: manual`, `total_amount`, `items`, `payer.email`, `external_reference`, `config.online` y una clave estable en `X-Idempotency-Key`. Las URLs se derivan de `FRONTEND_PUBLIC_URL` con rutas fijas y HTTPS. Solo se acepta `checkout_url` HTTPS de dominios oficiales de Mercado Pago.

## Intentos, reintentos y conciliación

`IntentoPago` conserva una solicitud inmutable, su huella, clave idempotente, estado de creación, ID externo y URL de checkout. La clave deriva de los IDs persistidos del pedido y su operación CAR-05. Un intento con respuesta confirmada se devuelve sin volver a crear; si hubo timeout o se perdió la respuesta, se reutilizan exactamente el mismo cuerpo y clave para que Orders API pueda deduplicar. Nunca se intenta revertir la operación externa con una transacción MongoDB.

Estados `CREANDO` o `INDETERMINADO` tras una interrupción requieren conciliación. No existe todavía consulta de estado de Orders ni webhook; por eso no se marca `Pedido.estadoPago` y no debe habilitarse el flujo hasta que una tarjeta posterior implemente confirmación confiable y recuperación operativa.

## Índices

El modelo declara `uniq_intento_pago_idempotencia` en `{ proveedor: 1, claveIdempotencia: 1 }` y un índice de consulta por pedido/fecha. Mongoose tiene `autoIndex:false`; este cambio no crea índices. Antes de provisionar el índice único en una base existente: respaldar, diagnosticar claves duplicadas, revisar documentos y provisionar en una copia aislada; luego verificar `listIndexes()` y probar solicitudes simultáneas. No aplicar índices a Atlas desde el arranque.

## Configuración

- `MP_ACCESS_TOKEN`: token privado, solo en backend y de prueba.
- `MP_ENVIRONMENT=test`: entorno admitido por esta preparación.
- `MP_ORDER_CREATION_ENABLED=false`: interruptor explícito de creación Orders.
- `MP_ORDER_FLOW_READY=false`: requiere pruebas aisladas CAR-05/CAR-06, índices y transacciones verificadas.
- `MP_WEBHOOKS_READY=false`: requiere webhook autenticado y actualización de pago probada.
- `FRONTEND_PUBLIC_URL`: origen HTTPS del frontend; `FRONTEND_URL` existente permanece reservado a CORS.

No editar `.env` desde esta tarea. `.env.example` contiene ejemplos no secretos.

## Retornos

Frontend: `/checkout/exito`, `/checkout/pendiente`, `/checkout/error`. Las páginas son informativas y no leen query params para identificar pedidos ni declarar pagos. Incluso `/checkout/exito` explica que la acreditación sigue pendiente de verificación. No deben considerarse prueba de pago.

## Dependencias antes de habilitar

1. Ejecutar QA CAR-05 y CAR-06 en una base replica set exclusiva para pruebas, con índices únicos y concurrencia/rollback verificados.
2. Aprovisionar y verificar los índices de `IntentoPago` en el entorno previsto.
3. Implementar webhook autenticado, consulta/conciliación de Orders y transiciones seguras de pago; nunca confiar en retornos del navegador.
4. Resolver política de vencimiento de reservas de Mercado Pago con CAR-06.
5. Integrar un endpoint que solo pueda operar sobre un pedido persistido y accesible por el comprador autenticado o una capacidad de acceso segura. No aceptar IDs arbitrarios como autorización.
6. Probar únicamente con credenciales de testing y pedidos de una base aislada.

## Verificación local

Las pruebas unitarias de `test/mercadoPagoOrders.test.js` usan fetch simulado y no cargan `.env`, no conectan a MongoDB ni llaman al proveedor. No se ejecutó seed ni prueba real de Mercado Pago.
