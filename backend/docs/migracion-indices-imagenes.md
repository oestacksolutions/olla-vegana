# Índices y recuperación de imágenes (CAT-04)

`ImagenProducto` mantiene en MongoDB solo la URL HTTPS, el `publicId` de
Cloudinary, la asociación al producto/variante y los metadatos. Los bytes se
transmiten en memoria con límites y pasan directamente al almacenamiento
externo; no se guardan en MongoDB ni en el disco del backend.

## Índice de imagen principal

El modelo declara el índice único parcial `uniq_imagen_producto_principal`:

```javascript
db.imagenproductos.createIndex(
  { productoId: 1, esPrincipal: 1 },
  {
    unique: true,
    name: 'uniq_imagen_producto_principal',
    partialFilterExpression: { esPrincipal: true }
  }
)
```

`ImagenProducto` tiene `autoIndex: false`; el backend no debe crear índices al
arrancar. Antes de crear el índice, respaldar la base, inspeccionar
`getIndexes()` y diagnosticar grupos de más de una imagen con `esPrincipal:
true` para el mismo producto. Resolverlos manualmente, sin cambiar imágenes ni
elegir una principal por inferencia. Los documentos heredados sin `esPrincipal`
no participan en el índice y siguen siendo visibles en el catálogo. Reanudar
escrituras administrativas solo después de confirmar el índice en la base.

Como `autoIndex` se deshabilita en todo el modelo, revisar y provisionar también
de forma controlada los índices existentes de `{ productoId, posicion }` y
`{ varianteId }` si faltan. No se ejecuta ningún cambio de base en esta tarea.

Consulta de diagnóstico de solo lectura antes de crear el índice:

```javascript
db.imagenproductos.aggregate([
  { $match: { esPrincipal: true } },
  { $group: { _id: '$productoId', cantidad: { $sum: 1 }, imagenes: { $push: '$_id' } } },
  { $match: { cantidad: { $gt: 1 } } }
])
```

## Fallos parciales de Cloudinary y MongoDB

Antes de subir se registra un documento marcador `PENDIENTE` con un `publicId`
aleatorio generado por el servidor. Cuando el upload y la transacción de MongoDB
terminan, pasa a `ACTIVA`. Si falla la escritura final, el backend intenta
eliminar cada recurso externo y el marcador; si Cloudinary o MongoDB no permite
la compensación, el marcador conserva el ID y queda `PENDIENTE_LIMPIEZA`. La
galería pública omite estos estados. Un administrador puede reintentar el DELETE
de esa imagen; la eliminación de Cloudinary es idempotente.

Al reemplazar un archivo, primero se registra el nuevo marcador y se carga el
nuevo recurso. Una transacción cambia la URL/ID y conserva el ID anterior en
`publicIdPendienteEliminar`; recién después se intenta borrar el anterior. Si
falla, el ID queda guardado para reintento en el siguiente reemplazo o al retirar
la imagen. Nunca se aceptan IDs de Cloudinary del cliente.

Las transacciones requieren MongoDB con replica set o clúster compatible.
Mientras no se configure Cloudinary, el adaptador rechaza cargas con 503 sin
crear marcadores ni intentar operaciones externas.

Los documentos antiguos con `url` pero sin `publicId` permanecen legibles. El
backend no deriva un ID externo de una URL arbitraria: al reemplazarlos,
conserva la URL anterior en `urlPendienteRevision`; al eliminarlos, bloquea la
operación para revisión manual. Así no se pierde la referencia ni se intenta
borrar un recurso que no puede demostrarse que pertenece a la tienda.
