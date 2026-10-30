# Contexto técnico de Olla Vegana

Documento de incorporación para quienes desarrollen nuevas tarjetas del proyecto. Describe el código inspeccionado en este repositorio; no certifica despliegues, datos de producción, estados de Trello ni recursos externos que no puedan verificarse desde Git.

> **Estado de esta auditoría:** inspección estática del repositorio en `main`, sin cambios funcionales, sin lectura de `.env`, sin conexión a MongoDB y sin ejecutar seeds, pagos ni pruebas. Las pruebas que aparecen en el inventario son archivos existentes, no resultados nuevos de ejecución.

## 1. Resumen ejecutivo

Olla Vegana es una organización y tienda online cuyo repositorio reúne un sitio institucional, una tienda React y una API Express/Mongoose. Hay un panel administrativo navegable, pero su cobertura es mixta: productos, imágenes, inventario y confirmación administrativa de transferencias tienen rutas backend montadas y protegidas; gran parte de la interfaz administrativa de pedidos, categorías, banners, retiros y configuración sigue siendo demostrativa/localStorage. Que una pantalla aparezca en el panel no significa que persista en MongoDB.

El backend está migrado operativamente a Mongoose. Permanecen archivos Prisma/Migration históricos en `backend/prisma`, pero el servidor activo importa Mongoose y el script `npm run seed` apunta a `backend/src/seeders/seed.js`. No se debe inferir que las migraciones Prisma inicializan MongoDB.

Los puntos de mayor riesgo antes de habilitar compras/pagos en producción son: creación pública de pedidos aún no montada; reservas y expiraciones sin worker programado; flags de Mercado Pago cerradas por defecto y sin verificación operativa aquí; índices críticos declarados pero no comprobados físicamente; y falta de permisos granulares para separar operaciones de catálogo, inventario y finanzas.

## 2. Objetivo del proyecto

La solución presenta la misión, campañas y donaciones de Olla Vegana, expone un catálogo comercial y prepara un flujo de carrito, checkout y pagos. La compra debe conservar snapshots históricos y separar stock físico, reservas, estado del pedido y estado del pago.

Roles observados:

- **Sitio institucional:** cuenta la misión, campañas, actividades, mapa y donaciones. El contenido está principalmente escrito en componentes y assets.
- **Tienda:** consulta catálogo y categorías del backend, muestra detalle/variantes/disponibilidad y usa carrito local; el checkout recopila datos, retiro y método de pago, pero no crea el pedido públicamente.
- **Backend:** API Express, modelos Mongoose, autenticación administrativa, catálogo, validación de carrito, retiros, imágenes, stock, transferencias y recepción de notificaciones de Mercado Pago.
- **Panel:** interfaz React bajo `/admin`; algunas operaciones usan API real y otras guardan una demostración en el navegador.

No es posible confirmar desde el repositorio cuáles funcionalidades o sitios están desplegados en producción ni qué versión está publicada.

## 3. Stack y arquitectura

| Área | Tecnologías / versiones declaradas |
|---|---|
| Backend | Node.js, CommonJS, Express `^5.3.0`, Mongoose `^9.11.4`, MongoDB |
| Backend adicional | bcryptjs, dotenv, cors, helmet, express-rate-limit, MercadoPago SDK, multer, nodemailer |
| Frontend | React `^19.1.0`, React DOM, Vite `^6.0.5`, Tailwind `^3.4.17`, ESM |
| UI / mapa | lucide-react, Leaflet, react-leaflet |
| Tests | `node:test` / `node:assert` en ambos proyectos; frontend no declara script de test |

Arquitectura backend: `index.js` carga configuración, conecta MongoDB mediante `src/config/db.js` y recién entonces levanta Express. `src/app.js` compone middlewares, servicios y routers. La mayoría de rutas administrativas construye controllers/services mediante factories y recibe modelos como dependencias. Errores usan `AppError`, `asyncHandler`, `notFound` y `errorHandler`.

Arquitectura frontend: `frontend/src/App.jsx` resuelve rutas por `window.location.pathname`; no usa React Router. La tienda comparte `StoreLayout`, servicios API y estado local del carrito. El panel tiene su propio `AdminApp` y `AdminLayout`.

## 4. Estructura del repositorio

- `backend/index.js`: entrada, conexión y ciclo de vida del servidor.
- `backend/src/app.js`: ensamblado de Express y rutas realmente activas.
- `backend/src/{config,controllers,middlewares,models,routes,services,utils,seeders}`: capas backend.
- `backend/test`: unit tests y pruebas de integración condicionadas por entorno.
- `backend/docs`: documentación CAR/PAG y procedimientos de índices.
- `backend/prisma`: artefactos heredados de la etapa Prisma; no son el runtime Mongoose actual.
- `frontend/src/components/home`, `layout`, `tienda`: sitio, layouts y componentes reutilizados.
- `frontend/src/pages`: sitio, tienda, acceso y pantallas de checkout.
- `frontend/src/admin`: panel, páginas, datos y servicio de administración.
- `frontend/src/{services,data,utils,context}`: acceso a API, estado local, rutas y funciones compartidas.
- `frontend/test`: pruebas Node de utilidades/flujo; no hay runner de componentes React declarado.

## 5. Frontend institucional

`App.jsx` muestra la página principal con `Navbar`, `Hero`, `Campaigns`, `MapSection`, `Donaciones`, `Store`, `MissionVision` y `Footer`. Hay además `/nosotros` y `/donacion`. Los componentes principales están en `frontend/src/components/home`; páginas dedicadas en `frontend/src/pages`.

La identidad usa Poppins y el asset local Scripter (`frontend/src/assets/fonts/Scripter-Regular.woff2`), además de imágenes y elementos gráficos locales. Las reglas están en `frontend/src/index.css` y Tailwind config. No asumir una única paleta antigua: conviven tokens del sitio y estilos específicos de tienda/panel.

El contenido institucional, campañas, hitos y llamados a donar se representa principalmente mediante JSX, assets y datos de frontend. Existe modelo `Banner`, pero en el código activo inspeccionado no hay API pública o administrativa de banners montada. No existe evidencia de un CMS para las campañas o secciones institucionales.

## 6. Tienda online

### Catálogo, detalle e imágenes

- `pages/tienda/HomeTienda.jsx`, `AllProductsPage.jsx`, `ProductDetailPage.jsx` consumen `services/catalog.js` y `services/api.js`.
- Rutas públicas: `/tienda`, `/tienda/productos`, `/tienda/:slug`.
- Hay filtro/búsqueda/orden URL, tarjetas (`components/tienda/ProductCard.jsx`), galería (`ProductGallery.jsx`) y respaldo local (`data/localProductImages.js`). La imagen API tiene prioridad; el asset local se utiliza cuando falta y el logo queda como último respaldo.
- Catálogo y detalle consultan endpoints públicos reales según la implementación; eso no prueba conectividad a una instancia específica.
- Las imágenes guardan metadata en MongoDB y bytes en Cloudinary cuando está configurado. El adaptador falla de forma controlada sin configuración; no se verificaron credenciales ni cargas reales.

### Precios, variantes y stock

El catálogo backend deriva precio de variante o precio base y disponibilidad desde stock físico menos reservas ACTIVA vigentes. La disponibilidad se limita para no presentar cifras negativas. La tienda permite seleccionar combinaciones reales de atributos y bloquea selección/compra cuando no puede confirmar disponibilidad. El carrito guarda una fotografía local, no reserva inventario ni reemplaza la validación del backend.

### Carrito

`data/storeCart.js` mantiene líneas identificadas por IDs reales de producto/variante, snapshot de atributos, precio, cantidad, slug e imagen en `localStorage`. La interfaz está en `StoreLayout` y se utiliza desde tarjetas y detalle. Los valores guardados en el browser son informativos/manipulables: `POST /api/cart/validate` recibe IDs y cantidades y reconstruye precios/disponibilidad desde MongoDB.

### Checkout y pedidos

`CheckoutPage.jsx` es un wizard de tres pasos: comprador, retiro, pago/revisión. Consulta `GET /api/pickup-options` y valida artículos con `POST /api/cart/validate`. Maneja opciones obsoletas y conserva un borrador temporal de formulario en `sessionStorage`. El flujo no llama a `POST /api/orders`; no se debe describir como compra completada ni habilitar un botón final real hasta cerrar CAR-05/CAR-06 y sus verificaciones.

Las páginas `/checkout/exito`, `/checkout/pendiente` y `/checkout/error` no acreditan pagos: el retorno del navegador no es evidencia financiera.

### Retiro y acceso a pedidos

`pickupService` alimenta el endpoint público de opciones; las opciones seleccionables dependen de estado/datos configurados. `PuntoRetiro` conserva compatibilidad con `horarios` texto heredado además de estructura nueva. `RetiroEspecial` requiere una fecha explícita y no debe generarse con fecha ficticia.

`TransferInstructionsPage.jsx` llama a un endpoint protegido por token opaco de acceso al pedido (el token se transmite en fragmento URL y se envía como autorización), sin usar número/importe desde query como fuente de verdad. La consulta solo está disponible para un pedido ya creado y con configuración. `OrderTrackingPage.jsx` y `OrderStatusPage.jsx` usan datos locales demo (`data/storeOrders.js`); no equivalen a seguimiento real en Mongo.

`TransferInstructionsPreviewPage.jsx` es una vista DEMO disponible solo en desarrollo, no una ruta de compra real.

## 7. Backend y API

### Entrada, conexión y seguridad general

`backend/index.js` espera a `connectDB()` antes de escuchar. `db.js` desactiva `autoCreate` y `autoIndex`. `app.js` aplica Helmet, CORS, límite JSON, rate limiting global/API y límites/validación reforzada en autenticación. Carga routers activos y termina con not-found/error handler.

`config/env.js` requiere `MONGODB_URI` y `JWT_SECRET`; no leer ni copiar `.env` en tareas de documentación. Variables sensibles documentadas solo por nombre en `backend/.env.example` incluyen credenciales MP, Cloudinary y SMTP.

### Inventario de endpoints activos

| Método y ruta | Controller / servicio | Auth | Estado y alcance |
|---|---|---|---|
| `GET /api/products` | catalogController / catalogService | Pública | Montada; productos activos para tienda, filtros/resumen. |
| `GET /api/products/:slug` | catalogController / catalogService | Pública | Montada; detalle e imágenes/variantes públicas. |
| `GET /api/categories` | catalogController / catalogService | Pública | Montada; categorías activas. |
| `POST /api/cart/validate` | cartController / cartValidationService | Pública, rate limited | Montada; validación de IDs/cantidades contra catálogo y disponibilidad; no crea pedido. |
| `GET /api/pickup-options` | pickupController / pickupService | Pública | Montada; opciones seleccionables desde modelos. |
| `GET /api/orders/:orderId/transfer-instructions` | orderAccessController / transferInstructionsService | Token opaco limitado; no JWT de admin | Montada; solo lectura de instrucciones/estado autorizado. |
| `POST /api/auth/login` | authController / authService | Pública con rate limit | Montada; inicia sesión administrativa. |
| `POST /api/auth/forgot-password` | authController / authService | Pública con rate limit | Montada; respuesta genérica y flujo SMTP si está configurado. |
| `POST /api/auth/reset-password` | authController / authService | Token de restablecimiento | Montada; restablece credencial admin. |
| `POST /api/webhooks/mercadopago` | webhook controller/service | Sin JWT; firma oficial y compuertas | Montada; valida firma y consulta proveedor; efectos de pago requieren configuración/índices y flags explícitos. No se verificó configuración real. |
| `POST /api/admin/orders/:orderId/transfer-confirmation` | adminTransferController / transferPaymentService + stockReservationService | `authenticate` + `authorizeAdmin` | Montada; operación financiera administrativa, sujeta a autorización de pago, índices y transacciones. No hay roles diferenciados en `Admin`. |
| `GET /api/admin/products` | adminProductController / adminProductService | `authenticate` + `authorizeAdmin` | Montada; lista productos incluyendo inactivos y filtros/paginación. |
| `GET /api/admin/products/:id` | adminProductController / adminProductService | Igual | Montada; detalle admin. |
| `POST /api/admin/products` | adminProductController / adminProductService | Igual | Montada; alta sin imágenes/variantes/stock. |
| `PATCH /api/admin/products/:id`, `PUT /api/admin/products/:id` | adminProductController / adminProductService | Igual | Montadas; actualizan campos permitidos. |
| `PATCH /api/admin/products/:id/visibility` | adminProductController / adminProductService | Igual | Montada; activa/oculta sin borrar. |
| `GET /api/admin/products/:productId/images` | adminImageController / adminImageService | `authenticate` + `authorizeAdmin` | Montada; consulta galería. |
| `POST /api/admin/products/:productId/images` | adminImageController / adminImageService + storage | Igual | Montada; carga limitada, requiere Cloudinary configurado. |
| `PATCH /api/admin/products/:productId/images/order` | adminImageController / adminImageService | Igual | Montada; reordenamiento. |
| `PUT /api/admin/products/:productId/images/:imageId/file` | adminImageController / adminImageService | Igual | Montada; reemplazo con compensación/limpieza pendiente. |
| `PATCH /api/admin/products/:productId/images/:imageId` | adminImageController / adminImageService | Igual | Montada; alt, principal/orden/variante según validación. |
| `DELETE /api/admin/products/:productId/images/:imageId` | adminImageController / adminImageService | Igual | Montada; elimina galería/recurso externo con control de fallos. |
| `GET /api/admin/stock` | adminStockController / adminStockService | `authenticate` + `authorizeAdmin` | Montada; consulta inventario, reservas y filtros/paginación. |
| `GET /api/admin/stock/:variantId` | Igual | Igual | Montada; detalle. |
| `GET /api/admin/stock/:variantId/movements` | Igual | Igual | Montada; historial solo lectura. |
| `POST /api/admin/stock/:variantId/adjustments` | Igual | Igual | Montada; ajuste transaccional/idempotente, dependiente de índice físico verificado. |

### Rutas implementadas en archivos pero NO montadas

| Módulo | Rutas previstas | Estado real |
|---|---|---|
| Categorías admin | GET/GET:id/POST/PATCH bajo `/api/admin/categories` | Router/service/controller existen; no está en `app.js`. |
| Atributos/valores | GET/POST/PATCH atributos y valores | Existen; no montados. |
| Variantes | GET/POST/PATCH por producto | Existen; no montados. No exponer hasta autenticar y confirmar índice de combinación. |
| Pedidos | `POST /api/orders` en `orderRoutes.js` | Router responde 503 explícito, y además no está montado. `orderService` no implica endpoint activo. |
| Operaciones de pedido/reintegro | cancelación, solicitud/confirmación de reintegro en `adminOrderOperationsRoutes.js` | Routes/services/controllers existen, pero el router exige middleware granular no configurado y no se monta. |
| Mercado Pago order creation | Servicio PAG-01 para crear order | Cliente/servicio existen; no hay controller/router montado que lo invoque. Flujo de checkout no conectado. |
| Banners, puntos de retiro admin, configuración, admins | CRUD deseable | Modelo o demo frontend, pero no hay API admin activa para estas entidades. |

**No añadir una ruta a `app.js` por el solo hecho de que exista su router.** Revisar auth, permisos, índices, transacciones, datos existentes y contrato consumidor.

## 8. MongoDB y modelos

Hay 22 modelos Mongoose. Sus esquemas declaran referencias/validaciones e índices. Como `autoIndex:false` está configurado, una declaración en el modelo no demuestra que el índice exista en Atlas.

| Modelo | Responsabilidad, relaciones y notas |
|---|---|
| `Admin` | Cuenta administrativa, correo único, hash de contraseña oculto por defecto, activo y tokens de recuperación. No define roles granulares. |
| `Producto` | Catálogo, slug único, categoría referenciada, descripción, precio base Decimal128, visibilidad/destacado y timestamps. |
| `Categoria` | Nombre/slug único, estado y relación jerárquica opcional con padre. |
| `Atributo` | Catálogo reutilizable de atributos (p. ej. talla/color), nombre/estado según modelo. |
| `ValorAtributo` | Valor dentro de un atributo; unicidad compuesta atributo+valor. |
| `Variante` | Producto, precio opcional, stock físico, activa, revisionReserva y clave canónica de combinación; índice único parcial de combinaciones activas requiere migración documentada. |
| `ValorVariante` | Relación Variante–ValorAtributo; índice único para evitar repetir el mismo valor en la misma variante. |
| `ImagenProducto` | Metadata de imagen, producto y variante opcional, URL/publicId, orden, principal y estado de limpieza; bytes fuera de Mongo. Índice principal único parcial documentado. |
| `MovimientoStock` | Auditoría de inventario: tipo, delta/cantidad, stock antes/después, motivo, admin e idOperacion; índice idempotente parcial. |
| `ReservaStock` | Pedido/variante/cantidad, estado ACTIVA/CONFIRMADA/LIBERADA, fechas y datos de liberación; unicidad pedido+variante e índices requeridos por servicio. |
| `Pedido` | Número público único, comprador snapshot, total Decimal128, método/estado pedido/pago/reintegro, referencias y snapshots de retiro, idempotencia y token de acceso hash/expiración. |
| `ItemPedido` | Producto/variante referenciados más snapshots de nombre, slug, atributos, cantidad, precio unitario y subtotal históricos. |
| `HistorialEstadoPedido` | Transiciones de pedido con estado anterior/nuevo, fecha, nota y admin opcional. |
| `IntentoPago` | Asociaciones Pedido–Orders API, IDs externos, URL, hash solicitud, idempotencia y estados de creación/proveedor. Índices únicos del intento deben existir físicamente. |
| `EventoPago` | Recepción/procesamiento de evento Mercado Pago, request/event IDs, pedido/intent y estado. Deduplicación no debe equiparar ID de order y evento. |
| `ConfirmacionTransferencia` | Registro durable de confirmación administrativa, importe/referencia/admin/idempotencia y resultado; no marca el pago por acción del comprador. |
| `Reintegro` | Solicitudes e historial de devolución, importes Decimal128, proveedor, estado, motivo, auditoría y claves externas/idempotentes; índices múltiples controlados. |
| `PuntoRetiro` | Ubicación permanente, dirección opcional, texto legacy `horarios`, horarios estructurados, activo y habilitación de checkout. Mantener lectura del texto heredado. |
| `RetiroEspecial` | Fecha/lugar/horario propio, tipo (incluye Veganpaluja), estado y habilitación; sin fecha no debe ofrecerse. |
| `Configuracion` | Clave/valor para configuración de tienda, incluidas instrucciones de transferencia; no guardar secretos innecesarios. |
| `Banner` | Metadata para piezas desktop/mobile, orden/posición y fechas/estado; falta API conectada al panel/sitio. |
| `SeedInitialization` | Marca persistente de inicialización única del seed Mongoose; no ejecutar en base existente durante desarrollo. |

### Índices y migraciones controladas

- Variantes: `uniq_variante_producto_combinacion_activa` sobre producto + combinación, único y parcial. El documento `backend/docs/migracion-clave-combinacion-variantes.md` prescribe diagnóstico, respaldo, backfill, detección de duplicados y verificación antes de habilitar escrituras.
- Imágenes: `uniq_imagen_producto_principal`, parcial por `esPrincipal:true`; además índices de consulta de producto/posición y variante. Ver `backend/docs/migracion-indices-imagenes.md`.
- Stock: `uniq_movimiento_id_operacion` parcial; ver `backend/docs/migracion-indices-stock.md`.
- Reservas, pedidos, pagos y reintegros: servicios comprueban índices necesarios para idempotencia/consistencia y pueden responder servicio no disponible si faltan. Inspeccionar modelos y `assertIndexes` de cada service antes de desplegar.
- Cualquier índice único nuevo puede fallar por datos duplicados heredados. Hacer respaldo, diagnóstico de solo lectura, probar sobre copia aislada, resolver duplicados con decisión humana, provisionar controladamente y comprobar `getIndexes()`.

Las transacciones MongoDB requieren replica set o clúster compatible. El repositorio no prueba la topología real ni los índices de una base viva.

## 9. Catálogo e inventario (CAT)

| Bloque | Implementación observable | Activo / pendiente | Archivos guía |
|---|---|---|---|
| CAT-01 Productos | CRUD service/controller/router; list/get/create/update/visibility; frontend consulta y alta/edición parcial | API admin de productos montada y protegida por admin activo. UI mezcla campos reales y demo; stock/variantes no se gestionan desde producto. | `adminProduct*`, `AdminProductsPage.jsx`, `adminService.js` |
| CAT-02 Categorías | Backend CRUD service/controller/router y UI localStorage | Backend preparado, router no montado; interfaz no persiste en Mongo. | `adminCategory*`, `AdminCatalogPage.jsx` |
| CAT-03 Atributos/variantes | Validación de pertenencia, combinaciones, stock no editable; índice canónico | Services/routes existen, rutas no montadas. Índice físico no verificado; documentos previos necesitan backfill controlado. | `adminAttribute*`, `adminVariant*`, `variantCombination.js`, migración de combinación |
| CAT-04 Imágenes | Multer limitado, Cloudinary adapter, compensación, consulta/orden/reemplazo/retirada | API admin montada con auth. Requiere Cloudinary configurado; credenciales/cargas reales no verificadas. Índices aún no verificados en DB. | `adminImage*`, `cloudinaryStorage.js`, `imageUpload.js`, migración de imágenes |
| CAT-05 Stock | Consulta, movimientos, ajustes transaccionales e idempotencia | API montada y auth admin; escritura condicionada a índices y transacciones. Frontend de inventario sigue local/mock y no consume endpoint. | `adminStock*`, `stockAvailability.js`, migración de stock |
| CAT-06 Reservas | Reserva por pedido, confirmación, cancelación y expiración idempotente | Servicio CAR-06 existe y se usa en confirmación de pago/transferencia. No se crea pedido público; no hay worker/cron activo que invoque expiraciones. QA Mongo aislado pendiente. | `stockReservationService.js`, `car-06-reserva-stock.md` |
| CAT-07 Catálogo | Listado/detalle/atributos/precios/disponibilidad en tienda | Endpoints públicos montados, frontend conectado. No se verificó contra DB en esta auditoría. | `catalogService.js`, `catalog.js`, páginas tienda |

## 10. Carrito y checkout (CAR)

| Tarjeta | Estado en código | Dependencias y cautelas |
|---|---|---|
| CAR-01 carrito | Carrito localStorage con líneas por IDs, atributos e imágenes; controles y total frontend | Snapshot no es fuente de precio/stock; sin reservas ni pedido. `CartContext.jsx` debe revisarse antes de reutilizar: el flujo vigente usa `storeCart.js`. |
| CAR-02 validar carrito | `POST /api/cart/validate` activo; recalcula catálogo/precio/disponibilidad | No persiste. Pruebas unitarias de service; integración real no ejecutada aquí. |
| CAR-03 checkout | Wizard tres etapas, datos/retiro/pago, resumen y revalidación | No crea pedido. No interpretar “Continuar” como compra. |
| CAR-04 retiro | GET opciones reales, selección y validación de opción obsoleta | Depende de datos reales válidos; no CRUD admin conectado. |
| CAR-05 pedido | Servicio y router stub 503; snapshot histórico, numeración/idempotencia preparados | Persistencia pública deshabilitada/no montada. QA transaccional aislado e índices son requisito previo. |
| CAR-06 reservas | Servicio de inventario transaccional y transiciones | No habilitar pedido sin concurrencia, índices y transacciones verificados. Expiración necesita worker externo aún no activado. |

## 11. Pagos y transferencias (PAG)

| Tarjeta | Componentes existentes | Estado operativo observable |
|---|---|---|
| PAG-01 Mercado Pago Orders API | `mercadoPagoOrders.js`, `mercadoPagoOrderClient.js`, `IntentoPago`; payload histórico, idempotencia y retorno | Servicio preparado con flags y comprobación de índice, pero no está conectado a una ruta ni invocado por checkout. Sin token/entorno no se verificó llamada real. |
| PAG-02 Webhooks | Ruta POST activa, HMAC de `x-signature`, consulta autenticada de order, `EventoPago`, validación de referencia/monto/moneda/cuenta | Entrada activa; efectos financieros tienen compuertas explícitas. No hay QA externo/Mongo aislado acreditado por esta auditoría. |
| PAG-03 Transferencias | `transferInstructionsService`, token opaco de pedido, `ConfirmacionTransferencia`, confirmación admin protegida y `transferPaymentService` integrado con reservas | Lectura de instrucciones y endpoint de confirmación montados. Requiere pedido creado/configuración bancaria/índices y autorización operativa. La compra pública permanece bloqueada; correo de instrucciones no existe. |
| PAG-04 cancelaciones/reintegros | `orderCancellationService`, `refundService`, modelo `Reintegro`, routes/controllers y documentación | Preparados, no montados. Cancelar pedido, cancelar order MP, liberar reserva, devolver dinero y reponer stock son operaciones separadas. Flags externas cerradas por defecto; permisos granulares faltan. |

Los estados de pedido, pago, retiro y reintegro no son intercambiables. Nunca cambiar un estado financiero por parámetros de retorno, clic del comprador o datos del navegador.

## 12. Estado actual del panel administrativo

### Frontend

`frontend/src/admin/AdminApp.jsx` ofrece secciones `resumen`, `pedidos`, `productos`, `catalogo`, `inventario`, `banners`, `retiros`, `configuracion`. La ruta `/admin` usa `ProtectedRoute`; `AdminLayout` proporciona navegación responsive y logout.

`adminService.js` carga productos por API. El panel combina datos backend con `mockOrders` y estado local. Las pantallas de pedidos, categorías/atributos, inventario, banners, retiros y configuración muestran controles que pueden parecer persistentes, pero sus operaciones principales se guardan en memoria/localStorage. No implementar sobre esas llamadas locales sin distinguir demo y backend.

| Módulo panel | Estado real | Fuente actual | Riesgo/dep. |
|---|---|---|---|
| Dashboard | Parcial / mezcla real y mock | Productos por API; estadísticas/ventas/pedidos demo | No usar métricas para decisiones contables. |
| Pedidos | Solo frontend/mock | `mockAdminData.js`; cambios locales | Espera API administrativa de lectura/transiciones y autorización. |
| Productos | Parcial, parcialmente conectado | CRUD listado/crear/editar/visibilidad real; campos de UI que no admite API siguen locales o no se guardan | No presentar stock/variantes como guardados por formulario de producto. |
| Categorías y atributos | Solo frontend/mock; backend parcial no montado | localStorage | Requiere auth/permisos y montaje seguro. |
| Variantes | Backend solo, no conectado al panel | Services/routes no montados | Requiere índice de combinación comprobado y CAT-03 UI/API. |
| Imágenes | Backend conectado desde API y UI parcial | endpoints admin Cloudinary; controles de galería | Requiere Cloudinary y provisionamiento índice. |
| Inventario | Parcial/mock | UI modifica snapshot/local movements; no usa `/api/admin/stock` | Riesgo alto de creer que el stock real cambió. Integrar backend stock primero. |
| Pedidos/transferencias | Confirmación backend existe; UI no la integra como flujo real | endpoint admin protegido; pantalla pedidos mock | Requiere interfaz conectada, permisos financieros y QA. |
| Banners | Solo frontend/mock | `storeBanners.js` / localStorage; `Banner` solo modelo | No hay CRUD/backend ni publicación API. |
| Retiros | Solo frontend/mock | localStorage | No hay endpoints admin; opciones de checkout sí son públicas. |
| Configuración | Solo frontend/mock | localStorage; banco requiere `Configuracion` backend | No editar datos de transferencia desde esta pantalla. |
| Usuarios/roles | No implementado operativamente | sección informativa demo | Admin no contiene roles granulares. Requiere diseño de permisos y migración. |
| Cancelaciones/reintegros | Solo backend preparado y no montado | services/routes | Requiere permisos específicos, política comercial aprobada e índices/QA. |
| Notificaciones | No implementado para pedidos | SMTP está conectado al reset de contraseña | No asumir emails transaccionales. |

### Backend admin y autorización

`authService` implementa login/reset con bcryptjs y JWT firmado. `authenticate` valida token y `authorizeAdmin` comprueba que el documento `Admin` exista y esté activo. Esto protege actualmente las rutas montadas, pero no hay roles/permisos granulares en el modelo. Los controles del navegador (`ProtectedRoute`, token localStorage) mejoran navegación, pero nunca sustituyen autorización backend.

Las operaciones financieras/cancelaciones deberían exigir permisos separados. La UI que permita edición local no constituye autorización ni persistencia.

## 13. Autenticación, autorización y secretos

- Rutas admin activas utilizan `authenticate` + `authorizeAdmin` salvo que el propio endpoint sea webhook de proveedor. El ID de admin debe derivarse de la sesión, no del body.
- `authorizeAdmin` identifica admin activo; no distingue catálogo, stock, pagos ni reintegros.
- El webhook no usa JWT del comprador: verifica firma; consulta la order a Mercado Pago; valida vinculación e importe antes de cualquier efecto condicionado.
- Las instrucciones del pedido requieren token opaco limitado, no ID público por sí solo.
- `.env` está ignorado por `backend/.gitignore` y no está versionado en el estado inspeccionado. No colocar secretos en `VITE_*`, React, respuestas, logs o commits.
- En `frontend/.env` sólo deben vivir valores públicos como URL de API; no Access Token, secretos de firma, Cloudinary secret, SMTP ni JWT signing secret.

## 14. Testing y calidad

Backend: `npm test` (`node --test`), `npm run test:integration:orders` (archivo específico). Hay pruebas por servicios/controladores, modelos, rutas, seed y seguridad. Existen pruebas de integración de pedidos, webhook y transferencia, pero deben ejecutarse solo con base exclusiva, flags de seguridad adecuados y replica set; no se ejecutaron en esta auditoría.

Frontend: `npm run lint` ejecuta `oxlint src`; `npm run build` ejecuta Vite. Hay tests `.test.js` basados en Node para carrito, catálogo UI, checkout y transferencia, pero no hay script de test, jsdom ni runner de componentes React declarados. Ejecutarlos individualmente con Node cuando correspondan; eso no prueba el render visual completo.

`npm test` puede depender de creación de procesos del entorno; si el entorno reporta `spawn EPERM`, ejecutar archivos unitarios por separado y consignar claramente que es limitación del entorno. No conectarse a la base real para sortearlo.

**Resultado de esta auditoría:** no se ejecutaron tests, lint, build, seed ni integración. Los archivos de prueba identificados no equivalen a una ejecución actual. Tests de integración de escritura requieren `MONGODB_URI` separada, base nombrada de testing, replica set, verificaciones de índices y guardas explícitas. No reutilizar `.env` de desarrollo/productivo.

Scripts detectados:

- Backend: `npm start`, `npm run dev`, `npm test`, `npm run test:integration:orders`, `npm run seed` (este último ejecuta escritura; no usar contra datos existentes).
- Frontend: `npm run dev`, `npm run build`, `npm run lint`, `npm run preview`.

## 15. Integraciones pendientes y riesgos

### Bloqueantes para compra/pago real

1. QA de CAR-05/06 y pagos en MongoDB aislado con transacciones y concurrencia real.
2. Aprovisionar/verificar físicamente índices únicos requeridos antes de habilitar escrituras sensibles.
3. Decidir y activar de forma controlada `POST /api/orders` sólo tras integrar creación + reserva en una transacción; ahora no está montado.
4. Definir worker durable para expirar reservas (`expireDueReservations` existe, no hay scheduler activo); monitoreo/reintento y recovery.
5. Verificar configuración Mercado Pago de testing, URLs, vendedor/app, firma y conciliación. Flags cerradas por defecto en `.env.example`.
6. No habilitar reintegros externos; rutas no montadas, política comercial y permisos pendientes.
7. Definir roles/permisos administrativos y separar operaciones financieras sensibles.
8. Configurar y verificar Cloudinary antes de cargas reales; no asumir que env está presente.
9. Seguridad de acceso a pedidos: conservar token opaco, expiración y no exponer PII.

### Importantes pero no bloquean el catálogo público

- Conectar UI de stock, categorías, atributos, variantes, pedidos, banners, retiros y configuración con servicios reales.
- Crear CRUD/API para Banner y contenido institucional administrable si se confirma alcance.
- Migrar pantalla de seguimiento desde mocks a una API segura.
- Integrar correo de instrucciones/pedidos; hoy SMTP se usa para recuperación de contraseña.
- Pruebas automatizadas de componentes visuales y pruebas manuales responsive.

## 16. Variables de entorno por nombre y objetivo

Las variables requeridas/observadas están documentadas en `backend/.env.example`; aquí no se reproducen sus valores:

| Variables | Objetivo |
|---|---|
| `MONGODB_URI` | URI MongoDB del entorno backend. |
| `JWT_SECRET` | Firma/verificación JWT backend; mínimo según validación del código. |
| `PORT`, `NODE_ENV`, `FRONTEND_URL` | Arranque, modo y CORS. |
| `VITE_API_URL` | URL pública del API utilizada por el frontend. |
| `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `MP_PUBLIC_KEY`, `MP_ENVIRONMENT` | Cliente/validación de Mercado Pago; credenciales únicamente backend salvo clave pública. |
| `MP_ORDER_CREATION_ENABLED`, `MP_ORDER_FLOW_READY`, `MP_WEBHOOKS_READY`, `MP_WEBHOOK_EFFECTS_ENABLED`, `MP_REFUND_OPERATIONS_ENABLED`, `MP_ORDER_CANCELLATION_ENABLED` | Compuertas explícitas de funciones financieras. |
| `MP_APPLICATION_ID`, `MP_USER_ID`, `FRONTEND_PUBLIC_URL` | Verificación de cuenta/entorno y URLs de retorno. |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `IMAGE_MAX_SIZE_BYTES` | Almacenamiento externo de imágenes y límite de carga. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Envío de correo para autenticación/recuperación. |

La presencia de un nombre en `.env.example` no confirma que esté configurado en una instancia.

## 17. Dependencias y despliegue comprobable

- Hosting frontend: `frontend/vercel.json` aplica rewrite SPA a `index.html`; configuración compatible con Vercel está presente. No se confirma que un deployment concreto exista.
- Backend: scripts Node de inicio/desarrollo; no se identificó en esta inspección un manifiesto de plataforma que pruebe hosting productivo.
- Persistencia: MongoDB compatible con transacciones para flujos que las usan. No se accedió al clúster ni se consultó su topología.
- Cloudinary para archivos de imágenes; SMTP/Nodemailer para correo de recuperación; Mercado Pago para orders/webhooks cuando se habilite.
- `backend/prisma` conserva schema/migraciones SQL de MySQL como legado de migración. La aplicación activa no depende de Prisma y `npm run seed` selecciona el seeder Mongoose.

## 18. Reglas para desarrollar nuevas tarjetas

1. Abrir la tarjeta y traducirla a criterios verificables.
2. Leer este documento y `docs/GUIA_AGENTE_PANEL_ADMIN.md`.
3. Confirmar rama y `git status`; revisar las rutas montadas en `backend/src/app.js` y rutas de `frontend/src/App.jsx`.
4. Seguir llamada desde UI → servicio → route → controller → service → modelo; comprobar también consumidor y tests.
5. Clasificar cada pieza: montada/activa, solo backend, solo UI/mock, bloqueada o ausente.
6. Revisar permisos, índices físicos requeridos, transacciones, idempotencia, logs, estados históricos y contratos.
7. No habilitar endpoint bloqueado sin dependencias explícitas y autorización humana.
8. No usar producción para pruebas, seeds, índices o integración con proveedores.
9. Implementar pruebas unitarias; documentar por separado qué necesita MongoDB isolated o proveedor sandbox.
10. Ejecutar verificaciones pertinentes y describir exactamente qué no se ejecutó.
11. Revisar diff y limitar archivos al alcance acordado. Un agente no debe hacer commit/push sin aprobación humana explícita.

## 19. Trabajo simultáneo: Magalí y Matías

- Una rama por tarjeta, creada desde `main` actualizado; un PR acotado por funcionalidad.
- Acordar temprano quién toca archivos compartidos como `backend/src/app.js`, `frontend/src/App.jsx`, modelos usados por varios servicios, `env.js`, `api.js`, `AdminApp.jsx` y estilos globales.
- No incluir cambios ajenos al revisar/commitear. Inspeccionar `git status` antes de checkout o stage.
- No borrar trabajo local de otra persona; no usar `git reset --hard`, limpieza forzada ni push forzado sobre rama compartida sin revisión explícita.
- Al fusionarse un PR, actualizar la rama restante desde `main` y resolver conflictos manualmente; volver a correr pruebas relevantes.
- No desplegar seeds, backfills, migraciones o índices sobre Mongo real sin respaldo, diagnóstico, entorno de ensayo y acuerdo operativo.
- Dividir panel por capas/módulos para reducir concurrencia en `AdminApp.jsx` y `adminService.js`; coordinar contratos antes de que cada persona conecte una pantalla.

## 20. Matriz de módulos y dependencias

| Módulo | Estado real | Pruebas disponibles | Dependencias / bloqueo | Riesgo al modificar |
|---|---|---|---|---|
| Sitio institucional | Páginas activas, contenido principalmente fijo | No se ve test de componentes | CMS/banner no conectado | Medio: comparte `App.jsx`, CSS/assets |
| Catálogo público | Rutas backend + tienda conectadas | `catalogService.test.js`, `catalogUi.test.js` | Mongo para integración real | Alto: precio/stock/contratos API |
| Carrito | Persistencia local y UI | `storeCart.test.js` | CAR-02 para validar server | Medio: contrato que usa checkout |
| Checkout | Wizard y validación | `checkout.test.js` | Pedido público deshabilitado | Alto: no simular confirmación |
| Pedido | Service/snapshots, route deshabilitada/no montada | `orderService`, `orderController`, `orderRoutes`, `orderIntegration` tests | QA aislado + CAR-06 | Muy alto: dinero/inventario/historial |
| Reserva | Service transaccional | `stockReservationService.test.js`, integración | Replica set, índices y worker | Muy alto: sobreventa/doble liberación |
| Mercado Pago | Service + webhook montado; order creation no conectado | tests de orders/webhook y webhook integration | flags, credenciales sandbox, índices y QA | Muy alto: conciliación financiera |
| Transferencias | Instructions y confirmación admin montados | service + integración | pedido, banco configurado, token, transacciones | Alto: acreditación y stock |
| Reembolsos | Services/routes preparados, no montados | service/security tests | permisos financieros, política, índice y provider QA | Muy alto |
| Panel productos | Parcial real | `adminProductService.test.js` | permisos existentes; campos limitados | Alto: datos productivos |
| Panel categorías/variantes | UI mock; backend no montado | tests unitarios service | auth/middleware e índice variante | Medio-alto |
| Panel imágenes | API y UI parcialmente reales | `adminImageService.test.js` | Cloudinary + índice físico | Alto: archivos externos/huérfanos |
| Panel stock | UI mock, API activa | `adminStockService.test.js` | índice de operación y QA transaccional | Muy alto |
| Panel pedidos | UI mock; confirmación transferencia backend | pruebas transfer/order | API de órdenes + permisos granulares | Muy alto |
| Panel banners/retiros/config | UI localStorage/mock | sin backend equivalente identificado | API, política y persistencia | Medio-alto |
| Auth admin | Login/reset y protección básica activas | no inferir producción desde unit tests | roles/permisos faltantes | Muy alto |

## 21. Glosario

- **Stock físico:** unidades registradas en `Variante.stock`.
- **Reserva activa:** cantidad apartada para un pedido pendiente, con vencimiento; no descuenta el stock físico.
- **Stock disponible:** físico menos reservas activas vigentes, limitado a no negativo en respuesta pública.
- **Snapshot histórico:** nombres, atributos e importes copiados al pedido para que cambios futuros del catálogo no alteren la venta pasada.
- **Order / pago MP:** order externa y pago(s) contenidos no deben tratarse como el mismo ID/estado.
- **Token opaco de pedido:** credencial limitada para consultar instrucciones sin exponer pedido por ID/número solamente.
- **Índice declarado:** definición de modelo Mongoose; no significa que MongoDB ya lo tenga. Verificar con `getIndexes()` en entorno autorizado.
- **Mock/demo:** estado guardado localmente o fixtures de prueba; no es persistencia backend.
- **Ruta montada:** router incluido explícitamente en `app.js`; un archivo de route sin montaje no integra la API.
- **Compuerta (feature flag):** condición de configuración que mantiene una operación peligrosa deshabilitada.

## 22. Confirmaciones humanas antes de nuevas tarjetas

Verificar con el equipo: qué versiones están desplegadas; topología y base exclusiva de QA; índices presentes; flags efectivos en cada entorno; configuración de Cloudinary/MP/SMTP; política comercial de cancelaciones/reintegros; roles financieros y responsables; prioridad del panel; si se administrará contenido institucional desde Banner; y estado externo real de Trello. Este documento no reemplaza esas aprobaciones.
