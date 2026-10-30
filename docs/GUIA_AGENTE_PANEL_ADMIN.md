# Guía para el agente de Matías: Panel Administrativo

Esta guía es un contrato de trabajo para cualquier asistente que ayude a Matías en tarjetas administrativas de Olla Vegana. Complementa [`CONTEXTO_PROYECTO_OLLA_VEGANA.md`](CONTEXTO_PROYECTO_OLLA_VEGANA.md). Si una instrucción de Trello contradice la seguridad o el estado real del código, describir la discrepancia y no asumir que una ruta preparada puede habilitarse.

## Contexto breve

El repositorio tiene frontend React/Vite y backend Express/Mongoose. El panel navega bajo `/admin`, pero varias pantallas son demos que guardan datos en localStorage. En backend, productos, imágenes, stock y confirmación de transferencias tienen rutas montadas detrás de autenticación administrativa básica. Categorías, atributos, variantes y operaciones de cancelación/reintegro tienen código de backend sin montar. No hay permisos granulares por rol.

Leer primero el documento de contexto para el inventario de endpoints, modelos, tests, flags y riesgos.

## Qué existe y no se debe duplicar

- Autenticación: `backend/src/services/authService.js`, `middlewares/auth.js`, `routes/authRoutes.js`, `frontend/src/services/auth.js`, `ProtectedRoute.jsx`. No crear segundo login, JWT alternativo, token fijo ni bypass.
- Productos: `adminProductService.js`, controller/routes y API frontend `services/api.js` ya existen; las rutas están montadas.
- Imágenes: `adminImageService.js`, `cloudinaryStorage.js`, `imageUpload.js` y rutas montadas. No guardar binarios en Mongo/disco ni aceptar IDs externos de Cloudinary del cliente.
- Stock: `adminStockService.js`, `stockAvailability.js`, modelos de movimientos/reservas y rutas montadas; el panel todavía no consume el contrato real. No hacer escrituras directas de `Variante.stock` en pantallas ni duplicar lógica de reservas.
- Catálogo público, servicios API y manejo de errores están disponibles.
- Services para categorías, atributos y variantes están preparados; antes de montarlos, integrar middleware real, comprobar necesidad de permisos/índices y documentar. No duplicarlos bajo nombres nuevos.
- Pedido/reserva/pago ya tienen servicios de dominio; no construir otro inventario ni marcar estados por acción de UI.

## Reglas de seguridad no negociables

1. La protección de verdad vive en backend. `ProtectedRoute`, ocultar botones o CORS por sí solos no autorizan operaciones.
2. Revisar `backend/src/app.js`: el router debe montarse detrás de `authenticate` y autorización apropiada. No montar routes no protegidas para “probar rápido”.
3. El middleware actual `authorizeAdmin` verifica token y admin activo; no garantiza rol financiero ni permiso específico. Operaciones de stock, pagos, cancelación y reintegro requieren autorización granular antes de habilitarse.
4. Obtener `adminId` de la sesión autenticada, nunca de un campo libre del body.
5. Usar allowlist de campos, validar IDs Mongo, tipos, límites, estado actual y transiciones. No exponer errores internos, PII, tokens o credenciales en logs/respuestas.
6. No usar datos del navegador para importe, stock, identidad o estado financiero oficial.
7. No probar contra `olla_vegana` real. No ejecutar seed, migraciones, backfills, creación de índices o operaciones proveedoras durante trabajo normal.
8. Los flags de pago existen precisamente como compuertas; no cambiar defaults ni activar en desarrollo sin autorización explícita y prerequisitos cumplidos.
9. Asegurar índices en entorno aislado antes de depender de unicidad/idempotencia. `autoIndex:false`: Mongoose no los provisiona al arrancar.
10. No ejecutar reintegros/cancelaciones externas reales. No considerar retorno URL o click como pago.

## Patrones de código del repositorio

### Backend

- CommonJS (`require`, `module.exports`); Express 5.
- Separar route → controller → service → model. Services reciben modelos por inyección para facilitar mocks.
- Reutilizar `AppError`, `asyncHandler` y `errorHandler`; no filtrar detalles Mongoose.
- Respetar `app.js` como fuente de verdad para routers montados.
- Las operaciones que cambian varios documentos suelen usar `Model.db.startSession()` + `withTransaction`. Proveedor externo se invoca fuera de una transacción, luego se concilia con estados durables.
- Actualizaciones concurrentes deben usar filtros condicionales/versionado o índices, no sólo leer y luego escribir.
- Dinero: usar parser/cálculo por centavos (`cartValidationService`) y representación Decimal128 donde aplica; no sumar floats sin control.
- Idempotencia durable: clave + fingerprint de solicitud y constraint único verificado. Manejar E11000 como carrera/conflicto de dominio.
- Declarar modelos/índices no crea índice físico: dejar procedimiento operacional/documentación.

### Frontend del panel

- ESM JSX, Tailwind, lucide-react. Navegación manual en `AdminApp.jsx`, no React Router.
- Reutilizar `AdminLayout`, estados loading/error/empty, estilos y componentes existentes.
- Usar `frontend/src/services/api.js` / `auth.js`; no fetch paralelo con tratamiento diferente de token/error.
- Inspeccionar `adminService.js` y cada página para distinguir API real, fixture y localStorage. Etiquetar demos como demo, no como guardado si no hay persistencia servidor.
- Los formularios deben reflejar solo capacidades backend existentes; no mostrar éxito de guardado para campos ignorados.
- No incluir secretos en `VITE_*`; las variables de frontend son públicas por diseño.

## Procedimiento obligatorio para cada nueva tarjeta

1. **Leer la tarjeta de Trello** completa y extraer criterios, límites y definición de terminado.
2. **Leer ambos documentos**: `docs/CONTEXTO_PROYECTO_OLLA_VEGANA.md` y esta guía.
3. **Auditar módulos afectados** en frontend, `app.js`, routes, controllers, services, models, middleware y tests.
4. **Identificar dependencias y trabajo ya hecho.** Seguir la llamada completa; confirmar si endpoint está montado y si UI persiste realmente.
5. **Definir alcance**: qué es activo, demo, backend-only, bloqueado o ausente. No expandir a otro módulo.
6. **Crear una rama desde `main` actualizado** según el flujo del equipo. Antes, revisar `git status`; conservar cambios ajenos.
7. **Implementar con límites estrechos**, respetando contratos consumidores e historial. Coordinar cambios compartidos en `app.js`, `AdminApp.jsx`, `api.js`, modelos, `env.js`.
8. **Agregar/actualizar pruebas** con mocks para dominio/validación; pruebas reales sólo en base aislada con guardas verificables.
9. **Ejecutar verificaciones seguras**: tests pertinentes, sintaxis, lint/build según archivos; no ejecutar seed ni integración real por defecto.
10. **Presentar informe de cambios y riesgos**, marcando qué no se pudo verificar y qué índices/variables/permisos dependen del despliegue.
11. **Esperar aprobación humana antes de commit y push.** No hacer commit, push o merge automáticamente.

## Cómo investigar una tarjeta antes de tocar código

1. Consultar `git branch --show-current`, `git status --short`, archivos cambiados y rama base. No limpiar ni revertir trabajo ajeno.
2. Leer docs del dominio (`backend/docs/car-*.md`, `pag-*.md`, `migracion-*.md`) y contrastar contra implementación actual; documentación puede ser preparación, no prueba de activación.
3. Localizar route/controller/service/model y comprobar montaje en `app.js`.
4. Localizar consumidor frontend en `App.jsx`, servicios y página del panel.
5. Buscar datos mock, localStorage y resultados que no persisten.
6. Revisar esquema, estados, referencias históricas e índices declarados; encontrar `assertIndexes` y documentación de provisionamiento.
7. Revisar tests, entender si son mocks, integration o escriben datos. No inferir real integration por nombre de test.
8. Si falta auth, permiso, índice o transacción, documentar como dependencia y dejar ruta cerrada.

## Dependencias administrativas recomendadas

| Orden | Módulo | Prerrequisito y motivo |
|---|---|---|
| 1 | Auth/permisos | Mantener login existente; definir capacidades y middleware granular antes de exponer operaciones. El modelo Admin actual no tiene roles. |
| 2 | Catálogo admin básico | Productos ya montados. Integrar categorías y definir cómo crear/editar categorías antes de formularios que dependen de ellas. |
| 3 | Atributos y variantes | Confirmar backfill/índice de combinación y proteger historial antes de conectar UI. Stock sólo lectura en esta fase. |
| 4 | Imágenes | Configurar Cloudinary por entorno, verificar índice de principal y flujo de compensación. |
| 5 | Inventario | Consumir `/api/admin/stock`; verificar índice de operación, transacciones y concurrencia aislada. No persistir stock desde producto. |
| 6 | Pedidos | Antes de UI de estados: API de consulta/transiciones y snapshots; acordar permisos y política. Pedido público sigue bloqueado hasta QA CAR-05/06. |
| 7 | Transferencias/pagos | Configuración bancaria protegida, roles financieros, conciliación y QA; la confirmación admin ya tiene endpoint, pero requiere permisos granulares. |
| 8 | Cancelaciones/reintegros | Política aprobada, permisos financieros, índices, proveedor y recuperación antes de montar las rutas. |
| 9 | Retiros/banners/config | Definir contrato y backend CRUD; distinguir contenido del sitio y datos checkout. No asumir que modelo equivale a administración lista. |
| 10 | Usuarios/roles/auditoría | Diseñar autorización/auditoría antes de administrar credenciales y permisos desde UI. |

El orden puede variar según Trello, pero no omitir requisitos de seguridad por priorización de interfaz.

## Cómo integrar endpoints y permisos

1. Especificar contrato y campos permitidos antes de formulario.
2. Implementar service con validaciones de dominio e inyección de modelos.
3. Controller sólo traduce request/result/status; usar `asyncHandler`.
4. Route valida parámetros/body y protege por autorización específica.
5. Montar en `app.js` detrás del middleware correcto. La ausencia de montaje se debe conservar mientras falte permiso/índice.
6. Derivar admin ID de `req.user`/contrato real de middleware y verificar ese contrato; nunca confiar en body.
7. Para escrituras críticas, transacción, condición concurrente, idempotency key e índice verificado; no dejar transacción abierta durante llamadas HTTP externas.
8. Añadir tests que comprueben autorización/ausencia de montaje, además de casos de dominio.
9. Actualizar el API client frontend usando el contrato real y estados de error. No sustituir datos por fixture si falla API.

## Tests y verificaciones

- No instalar dependencias por defecto. Revisar scripts del package vigente.
- Backend unit: `npm test` o archivo individual `node --test test/<archivo>.test.js`; si `spawn EPERM`, informar y ejecutar tests individuales seguros.
- Integración: sólo con base MongoDB desechable/exclusiva, replica set, URI separada de la real, nombres/guardas verificadas e índices preparados. No reutilizar configuración local.
- Frontend: `npm run lint`, `npm run build`; los `.test.js` Node pueden ejecutarse individualmente, pero no validan interacción visual React por sí solos.
- Revisar `git diff --check`, syntaxis y el diff completo.
- Informe separa: passed ahora, no ejecutado, bloqueado por infraestructura, cubierto por mocks, confirmado en navegador.
- No enviar formularios de escritura a MongoDB real, no ejecutar seed ni proveedor de pagos durante test corriente.

## Mantener diseño y UX del panel

- Usar `AdminLayout` y `adminNavigation`; coordinar con quien esté editando `AdminApp.jsx`.
- Mantener tipografías, espacios, paleta, componentes Lucide y responsive del panel.
- Proporcionar loading/error/empty/disabled y feedback de guardado que refleje persistencia real.
- No reutilizar categorías de demo, órdenes mock o movimientos locales como si fueran datos productivos.
- Asegurar navegación teclado, etiquetas, confirmaciones para operaciones irreversibles y no ocultar errores de autorización.
- No mostrar PII innecesaria en tablas, logs o exportaciones.

## Git y trabajo con Magalí

- Una rama por tarjeta y un Pull Request acotado. No trabajar directamente en `main`.
- Confirmar rama, `git status` y archivos staged antes de cualquier acción.
- Evitar ambos cambiar al mismo tiempo `backend/src/app.js`, `frontend/src/App.jsx`, `frontend/src/services/api.js`, `frontend/src/admin/AdminApp.jsx`, `adminService.js`, modelos base y configuración global.
- Comunicar cambios de contrato antes de que otra persona dependa de ellos.
- Al integrar PRs, actualizar rama desde main y ejecutar regresión; resolver conflictos entendiendo ambos lados.
- Nunca `git reset --hard`, `git clean`, borrado de archivos o force push para “resolver” conflictos sin autorización explícita y revisión de cambios.
- No hacer commit/push automáticamente: esperar aprobación humana.

## Cómo informar trabajo incompleto

El informe debe enumerar archivos creados/modificados; endpoints montados/no montados; auth y permiso efectivos; cambios de contrato; estados y validaciones; tests ejecutados y naturaleza (mock/integration); índices comprobados o pendientes; flags/config pendientes; cambios a historial; operaciones externas no realizadas; y riesgos de despliegue. Usar frases inequívocas:

- “El service existe, pero el router no está montado”.
- “La ruta está montada, pero la UI actual sigue usando fixtures”.
- “El índice está declarado; su presencia física no se verificó”.
- “La prueba usa mocks; no demuestra transacciones/concurrencia real”.
- “No se ejecutó contra MongoDB ni proveedor externo”.

No afirmar “completo”, “seguro en producción” o “integración verificada” por un build o test mock exitoso.

## Archivos compartidos propensos a conflictos

| Archivo | Posibles cambios simultáneos |
|---|---|
| `backend/src/app.js` | Montaje de routes, wiring de modelos/services y middleware. Alta colisión. |
| `frontend/src/App.jsx` | Navegación global y nuevas pantallas. Alta colisión. |
| `frontend/src/admin/AdminApp.jsx` | Ruta de panel, snapshot, callbacks y navegación. Alta colisión. |
| `frontend/src/services/api.js` | API pública, token y admin clients. Cambios pueden afectar tienda y panel. |
| `frontend/src/admin/services/adminService.js` | Snapshots/fixtures y mutaciones de producto/orden. |
| `backend/src/config/env.js`, `.env.example` | Flags y configuración; nunca tocar `.env` real para tarjeta sin autorización. |
| Modelos `Pedido`, `Variante`, `ReservaStock`, `MovimientoStock`, `Admin` | Compartidos por CAT/CAR/PAG; requieren revisar snapshots, transacciones e índices. |
| `frontend/src/index.css`, Tailwind config | Estilos de todo el sitio y panel. |
| `backend/src/middlewares/auth.js` | Seguridad central; coordinar con responsable de autenticación. |

## Glosario breve

- **Activo/montado:** router realmente registrado por Express.
- **Preparado:** archivo/service existe pero puede no tener ruta, credenciales, índice o job activo.
- **Mock/demo:** datos locales de muestra, sin persistencia backend.
- **Permiso granular:** autorización explícita para una acción (p. ej. reintegro), más estricta que “usuario admin activo”.
- **Idempotencia:** reintento de una operación no produce una segunda escritura/efecto; necesita estado durable e índice.
- **Índice físico:** índice comprobado en MongoDB con `getIndexes()`, no sólo definido en schema.
- **Worker:** proceso durable separado del request HTTP que procesa expiraciones/reintentos.

## Decisión final del agente

Ante duda sobre acceso, permisos, stock, pago, historial, índice o datos reales: mantener cerrada la operación, completar análisis no destructivo y elevar el bloqueo con evidencia concreta. Nunca habilitar una ruta protegida por intuición ni porque el frontend ya tenga un botón.
