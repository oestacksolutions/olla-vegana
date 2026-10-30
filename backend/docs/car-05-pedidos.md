# CAR-05 · Pedidos y preparación para reservas CAR-06

## Estado de habilitación

La creación pública de pedidos está deshabilitada. `POST /api/orders` no está montado en `src/app.js`; además, el router futuro (`src/routes/orderRoutes.js`) responde `503` por defecto y no llama al servicio. No cambiar esa protección hasta que CAR-06 integre creación de pedido y reserva atómica en una sola transacción.

El servicio de dominio existe para preparar esa integración y probar snapshots. No se debe exponer directamente antes de CAR-06: su consulta de CAR-02 es una fotografía de disponibilidad, no una reserva y no evita sobreventas.

## Contrato previsto para CAR-06

`POST /api/orders`, protegido contra abuso por los middlewares públicos existentes, recibirá el encabezado `Idempotency-Key` y únicamente:

```json
{
  "nombre": "Nombre",
  "apellido": "Apellido",
  "correo": "persona@example.test",
  "telefono": "+54 9 11 5555-1234",
  "observaciones": "Opcional",
  "retiroId": "PUNTO:<ObjectId> o ESPECIAL:<ObjectId>",
  "metodoPago": "MERCADO_PAGO o TRANSFERENCIA",
  "articulos": [{ "productoId": "<ObjectId>", "varianteId": "<ObjectId>", "cantidad": 1 }]
}
```

El navegador no puede enviar precio, subtotal, total, número, estado ni estado de pago. Los precios y los nombres/atributos se obtienen del resultado oficial de CAR-02. La opción de retiro se vuelve a consultar y debe seguir marcada como seleccionable.

## Persistencia histórica

- `Pedido.total` y `ItemPedido.precio/subtotal` usan `Decimal128`; los importes se calculan/normalizan con centavos enteros de CAR-02.
- `ItemPedido` conserva referencias de producto/variante y una copia del nombre, slug y pares atributo/valor al momento de compra.
- `Pedido` conserva el ID de la modalidad y una copia de nombre, dirección y horarios (o fecha, lugar y franja especial).
- `observaciones` es opcional, con máximo 1000 caracteres. `actualizadoEn` se agrega mediante timestamps; los documentos históricos que no tengan estos campos siguen siendo legibles.
- Se crea un registro inicial `NUEVO` en `HistorialEstadoPedido` junto al pedido e ítems.

Los estados de pedido y pago son distintos. Las transiciones definidas están en `src/utils/orderStates.js`; CAR-05 no publica operaciones para cambiarlos ni confía en estados enviados por el comprador.

## Número e idempotencia

El número persistido es un entero seguro con fecha UTC `AAAAMMDD` y sufijo aleatorio de seis dígitos (por ejemplo, `20261029012345`); para presentación puede prefijarse `OV-`. Ante colisión, el servicio reintenta y depende del índice único de `Pedido.numero`. `Idempotency-Key` se guarda en `Pedido.idOperacion`; su huella SHA-256 permite devolver el mismo pedido ante un reintento idéntico y responder conflicto si la clave se reutiliza con otros datos.

Los esquemas declaran el índice único de número y un índice único parcial `uniq_pedido_id_operacion`. Los índices de pedido/ítem usan `autoIndex: false`; no se crean índices en Atlas desde esta tarea. Antes de habilitar el endpoint:

1. Hacer backup y ejecutar un diagnóstico de documentos y claves existentes en una base de desarrollo o con el responsable de producción.
2. Confirmar que `numero` no contiene duplicados y que existe un índice único equivalente al declarado.
3. Confirmar que `idOperacion` no tiene duplicados; normalmente los documentos antiguos no tienen este campo y quedan fuera del índice parcial.
4. Crear de forma controlada el índice único parcial `{ idOperacion: 1 }` con filtro `{ idOperacion: { $type: "string" } }`, nombre `uniq_pedido_id_operacion`.
5. Verificar el catálogo de índices y realizar pruebas concurrentes/idempotentes en una base aislada.

Hasta que esos índices estén efectivamente presentes, el código no debe considerarse protegido contra colisiones concurrentes en una base real.

## Dependencia transaccional CAR-06

El driver exige MongoDB en replica set o clúster compatible con transacciones. CAR-06 debe:

1. Abrir una sesión y transacción.
2. Volver a validar artículos y retiro dentro del flujo transaccional.
3. Reservar cada variante con una operación condicional que compruebe stock disponible, sin permitir cantidades negativas.
4. Crear `Pedido`, `ItemPedido`, historial inicial y reservas utilizando esa misma sesión.
5. Confirmar todo junto o abortar todo; los reintentos deben conservar `Idempotency-Key` y la huella de operación.
6. Solo entonces conectar el controlador con el servicio y montar `createOrderRoutes` detrás de límites de solicitud adecuados. No hay que cambiar su bloqueo por defecto hasta completar esa integración.

CAR-05 no modifica `Variante.stock`, `ReservaStock` ni `MovimientoStock`, no vence reservas, no procesa pagos y no envía correos.

## QA de integración aislado

`test/orderIntegration.test.js` no carga dotenv ni `MONGODB_URI`. Solo acepta `MONGODB_CAR05_TEST_URI` cuando la URI apunta exactamente a la base `olla_vegana_car05_test` y `CAR05_TEST_DATABASE_ISOLATED=1` confirma explícitamente el aislamiento; si falta cualquiera de esas condiciones, la suite queda omitida y no conecta. Use un proyecto/cluster dedicado (preferido) o una instancia local configurada como replica set, y una cuenta con permisos de administración limitados a esa base de testing (necesarios para crear índices y retirar las colecciones efímeras), sin permisos sobre producción. No reutilice la URI de desarrollo o producción aunque apunte a otra base.

La prueba crea colecciones con un sufijo aleatorio, provisiona índices únicamente en esas colecciones, inserta fixtures de catálogo/retiro exclusivos de QA y elimina al finalizar únicamente las colecciones que creó. No llama al seed ni monta la ruta pública.

Para ejecutarla en un entorno ya provisionado, configure la URI desde el almacén seguro local o de CI en `MONGODB_CAR05_TEST_URI`, confirme el aislamiento con `CAR05_TEST_DATABASE_ISOLATED=1` y corra:

```sh
npm run test:integration:orders
```

No incluya la URI en comandos guardados, capturas, logs ni reportes. La validación del nombre de base es un resguardo adicional; la separación del cluster y los permisos de la cuenta de testing siguen siendo requisitos operativos.
