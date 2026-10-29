# CAR-02: contrato de validación del carrito

## Endpoint

`POST /api/cart/validate` es público y de solo lectura. No crea pedidos, reservas ni movimientos de stock.

Solicitud:

```json
{
  "articulos": [
    {
      "productoId": "<ObjectId del producto>",
      "varianteId": "<ObjectId de la variante>",
      "cantidad": 2
    }
  ]
}
```

El cuerpo acepta únicamente `articulos`; cada línea acepta únicamente `productoId`, `varianteId` y `cantidad`. Cualquier propiedad adicional se rechaza con HTTP 400. Precios, nombres, disponibilidad, subtotales, imágenes y totales del navegador nunca son fuente de verdad.

## Límites y duplicados

- Hasta 50 líneas recibidas por solicitud.
- Entre 1 y 100 unidades enteras por variante, también después de consolidar duplicados.
- Los IDs deben ser ObjectId hexadecimales válidos.
- Varias líneas del mismo producto y variante se consolidan y sus índices originales se conservan en la respuesta.
- Una variante presentada con otro producto se rechaza.
- El carrito vacío es inválido (HTTP 422).

## Respuesta

HTTP 200 indica que todas las líneas son válidas. `precioUnitario`, `subtotal` y `total` son cadenas decimales con dos posiciones para conservar precisión monetaria. HTTP 422 indica artículos semánticamente inválidos; la respuesta incluye `valido: false`, errores por artículo y `total: null`, sin presentar el carrito como comprable. Errores de forma o límites de entrada son HTTP 400. Errores temporales de base de datos pasan al middleware central.

Ejemplo de respuesta válida:

```json
{
  "valido": true,
  "articulos": [
    {
      "productoId": "<ObjectId>",
      "varianteId": "<ObjectId>",
      "indicesOriginales": [0],
      "cantidad": 2,
      "valido": true,
      "nombre": "Remera",
      "slug": "remera",
      "categoria": { "nombre": "Remeras", "slug": "remeras" },
      "variante": [{ "atributo": "Talle", "valor": "L" }],
      "cantidadReservada": 1,
      "stockDisponible": 9,
      "precioUnitario": "45000.00",
      "subtotal": "90000.00"
    }
  ],
  "errores": [],
  "total": "90000.00"
}
```

La disponibilidad es una lectura puntual de stock físico menos reservas activas vigentes. Las reservas confirmadas, liberadas y vencidas no se descuentan. Ante datos inconsistentes, el artículo se invalida en lugar de afirmar que hay disponibilidad.

## Protecciones y límites operativos

Express conserva el límite de tamaño del parser JSON existente y el servicio limita el número de líneas y cantidades. El proyecto no tenía rate limiter de solicitudes públicas; esta tarjeta no agrega uno ni una dependencia. Antes de exponer el endpoint a tráfico amplio, configurar límites por IP en el proxy/API gateway o agregar un limitador compartido entre instancias.

La respuesta es una fotografía del momento de consulta y no reserva unidades. El checkout deberá volver a validar y reservar el stock con operaciones transaccionales antes de confirmar una compra.
