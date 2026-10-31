# Resumen administrativo de la tienda

`GET /api/admin/dashboard/summary?period=30d` es una consulta administrativa de solo lectura. Express la monta detrás de `authenticate` y `authorizeAdmin`. Períodos aceptados: `today`, `7d` y `30d`.

## Fechas y métricas

- Pedidos realizados y pendientes de pago del período: `Pedido.creadoEn`.
- Pago acreditado: `Pedido.pagoVerificadoEn`, con fallback histórico a `pagadoEn` y luego `transferenciaRecibidaEn`. Solo entran pedidos con `estadoPago` `APROBADO` o `REEMBOLSADO`; `Pedido.total` aporta el importe bruto histórico acreditado. Los estados pendientes, rechazados y cancelados no se consideran ingresos.
- Reintegros: exclusivamente `Reintegro.estado === COMPLETADO`, usando `confirmadoEn` e `importeConfirmado`. Los solicitados o en revisión no reducen el importe informado.
- Neto: acreditaciones brutas menos reintegros completados ocurridos dentro de la misma ventana. Es un movimiento financiero del período, no ingresos por cohorte de pedidos. Si existe algún reintegro completado sin fecha o importe confirmados, `netReliable` queda en falso y el neto no se publica.
- Pedidos esperando retiro: estado de pedido `LISTO_PARA_RETIRAR` y pago `APROBADO`; es una alerta actual, no una métrica del período.
- Transferencias pendientes: pedidos no cancelados con `metodoPago=TRANSFERENCIA` y `estadoPago=PENDIENTE`; es una alerta actual.

`today` comienza a las 00:00 de `America/Argentina/Buenos_Aires` y termina al momento de consulta. `7d` y `30d` son ventanas móviles exactas de 7 × 24 y 30 × 24 horas.

## Stock bajo

Se agregan las existencias disponibles de las variantes activas de cada producto activo y se descuentan reservas `ACTIVA` cuya `venceEn` es posterior a la consulta. Un producto agotado tiene disponibilidad agregada igual a cero. El umbral es inclusivo y configurable con `ADMIN_LOW_STOCK_THRESHOLD`; si no se define, vale 5 unidades. Revisar la capacidad de consultas y el volumen de catálogos antes de elevar el umbral o ampliar las listas: el endpoint solo devuelve nombres de hasta cinco productos por grupo junto con el total.

## Privacidad y operación

La respuesta no incluye compradores, emails, teléfonos ni observaciones. El endpoint ejecuta agregaciones de lectura y no usa `populate`, escrituras ni provisión de índices. Los índices físicos y la integración con datos reales deben verificarse en el entorno correspondiente; las pruebas unitarias usan modelos simulados.
