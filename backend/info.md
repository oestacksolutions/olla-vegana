# Backend de Olla Vegana

Stack: Node.js, Express, MongoDB y Mongoose (CommonJS).

## Desarrollo

- `npm run dev`: inicia el servidor y conecta a MongoDB usando `MONGODB_URI`.
- `npm test`: ejecuta pruebas unitarias con dobles de modelos; no necesita conexión a MongoDB.
- `npm run seed`: inicializa datos una sola vez en una base vacía. No se ejecuta automáticamente.
- `GET /api/pickup-options`: consulta puntos activos y fechas especiales futuras habilitadas, indicando si cada opción puede seleccionarse.

El seed se puede ejecutar una sola vez y únicamente en una base sin documentos. Registra el estado en `seedinitializations`; ante datos existentes sin marca, marca previa incompleta o bloqueo concurrente, se detiene para revisión manual. No borra ni reemplaza documentos.

La inicialización usa una transacción MongoDB. El servidor debe ser un replica set (también puede ser un replica set de un solo nodo en desarrollo); una instancia standalone no es compatible. Si ocurre un fallo, los documentos de negocio se revierten y la marca queda fallida para evitar reintentos automáticos. Revisar la causa antes de decidir cómo continuar.

Los horarios habituales se guardan como día de semana y rango horario. Las fechas especiales Veganpaluja se registran por fecha, lugar y horario propios; no se crea una fecha en el seed. Los puntos iniciales quedan deshabilitados para checkout hasta que se confirme la dirección y se habiliten desde administración.

`PuntoRetiro` también conserva y expone el campo legado `horarios` como texto. Los documentos antiguos con dirección, estado activo y ese horario se consideran disponibles si todavía no tienen `habilitadoCheckout`; la API devuelve el texto original y no lo transforma ni lo escribe. No se necesita una migración de datos para leerlos.

`backend/.env.example` documenta las variables requeridas. Copiarlo a `.env` y configurar `MONGODB_URI` y `JWT_SECRET` localmente. No versionar `.env`.

Las rutas administrativas se mantienen sin montar hasta disponer de autenticación y autorización reales.

Los archivos `prisma/schema.prisma`, `prisma/migrations` y `prisma/seed.js` se conservan temporalmente como documentación del esquema y origen relacional. No ejecutar herramientas Prisma sobre la base MongoDB.

Los puntos de retiro y banners no se incluyen en el seed mientras no se confirmen direcciones, horarios y URLs reales.
