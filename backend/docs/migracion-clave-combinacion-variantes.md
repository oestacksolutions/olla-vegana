# Migración de la clave canónica de variantes

La aplicación incorpora `Variante.combinacionClave` con formato versionado:

- `v1:<atributoId>:<valorAtributoId>|...`, ordenado por ID de atributo y luego de valor.
- `v1:none` para una variante sin relaciones de atributos.

El índice requerido es `uniq_variante_producto_combinacion_activa`, único sobre
`{ productoId: 1, combinacionClave: 1 }` y parcial para documentos con
`activa: true` y `combinacionClave` de tipo string. Este diseño deja conservar
variantes inactivas con combinaciones repetidas. Una reactivación pasa a competir
por la clave única y se rechaza si otra variante activa ya la usa.

## Estado y requisitos previos

El modelo Mongoose deshabilita `autoIndex` para `Variante`: el arranque del
backend no debe crear este índice antes del backfill. La protección de base de
datos **no está activa en `olla_vegana` hasta completar todos los pasos de esta
migración**. El servicio conserva una comprobación previa y traduce errores
MongoDB `E11000` a HTTP 409, pero la comprobación previa por sí sola no protege
contra escrituras simultáneas.

MongoDB debe ejecutarse como replica set o clúster compatible con transacciones,
porque la escritura de la combinación y sus relaciones se realiza en una
transacción. Ejecutar primero en una restauración de respaldo o entorno de
desarrollo aislado.

## Procedimiento operativo

1. Programar una ventana sin escrituras administrativas de variantes. Tomar y
   verificar un respaldo consistente de la base. No guardar la URI ni secretos
   en este documento.
2. Hacer un diagnóstico de solo lectura de las siete variantes conocidas y de
   todas las existentes al momento de migrar:
   - Resolver cada `ValorVariante` a su `ValorAtributo` y cada valor a su
     `Atributo`.
   - Marcar referencias faltantes, valores repetidos, más de un valor del mismo
     atributo, `productoId` faltante y variantes que apuntan a productos
     inexistentes. Corregirlos mediante una decisión revisada antes de seguir;
     no adivinar ni descartar relaciones.
   - Tratar `activa` ausente como activa, que es la interpretación actual del
     servicio (`activa !== false`). Resolver casos ambiguos antes del backfill.
   - Calcular la clave `v1` con los pares atributo/valor ordenados; para cero
     valores usar `v1:none`. Agrupar por `productoId + combinacionClave` entre
     variantes activas. Si hay más de una en un grupo, abortar y decidir cuál
     desactivar/conservar antes de crear el índice. Nunca desactivar
     automáticamente.
3. En la restauración de prueba, hacer backfill idempotente con `$set` de
   `combinacionClave` para cada variante. Si `activa` no existe, escribir
   `activa: true` únicamente para preservar el comportamiento efectivo actual.
   No cambiar stock, precio, relaciones, pedidos, reservas ni movimientos. Las
   variantes inactivas también reciben clave para facilitar validación, aunque
   no participan en la unicidad.
4. Verificar de nuevo que todos los documentos tengan una clave que coincida
   con sus relaciones, que no haya referencias incompletas y que ningún grupo
   activo `(productoId, combinacionClave)` esté duplicado. Repetir estas
   verificaciones en la base objetivo antes de cualquier escritura.
5. Con escrituras administrativas todavía pausadas, aplicar el mismo backfill
   en la base objetivo y validar los conteos y agrupaciones. Si aparece cualquier
   discrepancia, detenerse y restaurar desde el respaldo o resolverla con una
   operación revisada.
6. Crear manualmente el índice único parcial:

   ```javascript
   db.variantes.createIndex(
     { productoId: 1, combinacionClave: 1 },
     {
       unique: true,
       name: 'uniq_variante_producto_combinacion_activa',
       partialFilterExpression: {
         activa: true,
         combinacionClave: { $type: 'string' }
       }
     }
   )
   ```

   Confirmar en `getIndexes()` que existe con esas claves y opciones. Reanudar
   escrituras solo después de esa comprobación.

   Como `autoIndex` está deshabilitado para el modelo completo, revisar también
   en `getIndexes()` los índices que el modelo ya declara (`productoId`,
   `productoId + activa` y `claveSeed` único/sparse). Conservar los existentes y
   provisionar de forma controlada los que falten; no depender del arranque de
   Mongoose para crearlos.

La creación del índice debe abortar ante duplicados; no usar opciones que los
eliminen o ignoren. El backfill es repetible porque usa `$set` de la clave
derivada y no reemplaza documentos. Las consultas públicas actuales no dependen
de `combinacionClave`; los documentos heredados siguen siendo legibles antes,
durante y después de la migración.

## Alcance

Este repositorio solo prepara el campo, el índice declarado y el procedimiento.
No ejecuta consultas, backfill, creación de índices ni cambios en MongoDB.
