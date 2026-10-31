const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const Producto = require('./models/Producto');
const Categoria = require('./models/Categoria');
const ImagenProducto = require('./models/ImagenProducto');
const Variante = require('./models/Variante');
const MovimientoStock = require('./models/MovimientoStock');
const ReservaStock = require('./models/ReservaStock');
const Pedido = require('./models/Pedido');
const ItemPedido = require('./models/ItemPedido');
const Reintegro = require('./models/Reintegro');
const HistorialEstadoPedido = require('./models/HistorialEstadoPedido');
const IntentoPago = require('./models/IntentoPago');
const EventoPago = require('./models/EventoPago');
const EmailOutbox = require('./models/EmailOutbox');
const ConfirmacionTransferencia = require('./models/ConfirmacionTransferencia');
const ValorVariante = require('./models/ValorVariante');
const ValorAtributo = require('./models/ValorAtributo');
const Atributo = require('./models/Atributo');
const PuntoRetiro = require('./models/PuntoRetiro');
const RetiroEspecial = require('./models/RetiroEspecial');
const Configuracion = require('./models/Configuracion');
const Banner = require('./models/Banner');
const { createCatalogService } = require('./services/catalogService');
const { createCartValidationService } = require('./services/cartValidationService');
const { createAuthService } = require('./services/authService');
const createCatalogController = require('./controllers/catalogController');
const createAuthController = require('./controllers/authController');
const createCatalogRoutes = require('./routes/catalogRoutes');
const createCartRoutes = require('./routes/cartRoutes');
const createAuthRoutes = require('./routes/authRoutes');
const createAdminProductRoutes = require('./routes/adminProductRoutes');
const createAdminImageRoutes = require('./routes/adminImageRoutes');
const { createCloudinaryStorage } = require('./services/cloudinaryStorage');
const createAdminStockRoutes = require('./routes/adminStockRoutes');
const createAdminAttributeRoutes = require('./routes/adminAttributeRoutes');
const createAdminVariantRoutes = require('./routes/adminVariantRoutes');
const createAdminDashboardRoutes = require('./routes/adminDashboardRoutes');
const createAdminOrderRoutes = require('./routes/adminOrderRoutes');
const createAdminBannerRoutes = require('./routes/adminBannerRoutes');
const createBannerRoutes = require('./routes/bannerRoutes');
const createAdminPickupRoutes = require('./routes/adminPickupRoutes');
const { createAdminOrderService } = require('./services/adminOrderService');
const { createAdminOrderController } = require('./controllers/adminOrderController');
const { createAuthMiddleware } = require('./middlewares/auth');
const {
  createCorsOptions,
  createApiRateLimiter,
  createAuthRateLimiter,
  validateJsonBody,
  validateAuthPayload,
  helmetMiddleware
} = require('./middlewares/security');
const createPickupRoutes = require('./routes/pickupRoutes');
const createWebhookRoutes = require('./routes/webhookRoutes');
const createMercadoPagoWebhookController = require('./controllers/mercadoPagoWebhookController');
const { createMercadoPagoOrderClient } = require('./services/mercadoPagoOrderClient');
const { createMercadoPagoWebhookService } = require('./services/mercadoPagoWebhookService');
const { createPaymentAuthorization } = require('./services/paymentAuthorization');
const { createTransferPaymentAuthorization } = require('./services/transferPaymentAuthorization');
const { createTransferPaymentService } = require('./services/transferPaymentService');
const createAdminTransferController = require('./controllers/adminTransferController');
const createAdminTransferRoutes = require('./routes/adminTransferRoutes');
const { createStockReservationService } = require('./services/stockReservationService');
const { createOrderService } = require('./services/orderService');
const { createPickupService } = require('./services/pickupService');
const { createOrderAccessTokenService } = require('./services/orderAccessToken');
const { createTransferInstructionsService } = require('./services/transferInstructionsService');
const { createEmailProvider } = require('./services/emailProvider');
const { createEmailOutboxService } = require('./services/emailOutboxService');
const createOrderAccessController = require('./controllers/orderAccessController');
const createOrderAccessRoutes = require('./routes/orderAccessRoutes');
const notFound = require('./middlewares/notFound');
const errorHandler = require('./middlewares/errorHandler');
const env = require('./config/env');
const logger = require('./utils/observability');
const requestLogging = require('./middlewares/requestLogging');
const createHealthRoutes = require('./routes/healthRoutes');

const app = express();
const logInventoryInconsistency = (entry) => {
  logger.warn('inventory.inconsistency', entry);
  void logger.alerts?.dispatch('inventory:inconsistency', 'inventory.inconsistency', entry);
};
app.locals.monitoring = { logger, alerts: logger.alerts };
app.use(requestLogging(logger));
logger.info('logging.policy.configured', { level: env.LOG_LEVEL, retentionDays: env.LOG_RETENTION_DAYS, destination: 'stdout/stderr' });
const paymentAuthorization = createPaymentAuthorization();
const transferPaymentAuthorization = createTransferPaymentAuthorization();
const orderAccessTokens = createOrderAccessTokenService(env.JWT_SECRET);
const transferInstructionsService = createTransferInstructionsService(
  { Configuracion, Pedido, ReservaStock },
  { orderAccessTokens }
);
const emailOutboxService = createEmailOutboxService(
  { EmailOutbox, Pedido, ItemPedido },
  { provider: createEmailProvider(env), transferInstructionsService }
);
const stockReservationService = createStockReservationService(
  { Pedido, Variante, ReservaStock, MovimientoStock, HistorialEstadoPedido },
  {
    verifyPaymentAuthorization: async (input) => (await paymentAuthorization.verify(input)) || transferPaymentAuthorization.verify(input),
    logger: logInventoryInconsistency,
    emailOutbox: emailOutboxService
  }
);
const transferPaymentService = createTransferPaymentService(
  { Pedido, ReservaStock, ConfirmacionTransferencia },
  { stockReservationService, transferPaymentAuthorization }
);
const adminOrderService = createAdminOrderService(
  { Pedido, ItemPedido, HistorialEstadoPedido, IntentoPago, ConfirmacionTransferencia, Reintegro, ReservaStock },
  {
    operationalChangesEnabled: env.ADMIN_ORDER_STATUS_CHANGES_ENABLED,
    transferConfirmationEnabled: env.ADMIN_TRANSFER_CONFIRMATION_ENABLED,
    emailOutbox: emailOutboxService
  }
);
const adminOrderController = createAdminOrderController(adminOrderService);
const orderAccessController = createOrderAccessController(transferInstructionsService);
const mercadoPagoWebhookService = createMercadoPagoWebhookService(
  { Pedido, IntentoPago, EventoPago },
  {
    env,
    orderClient: createMercadoPagoOrderClient({ accessToken: env.MP_ACCESS_TOKEN }),
    stockReservationService,
    paymentAuthorization,
    emailOutbox: emailOutboxService
  }
);
const mercadoPagoWebhookController = createMercadoPagoWebhookController(mercadoPagoWebhookService);
const catalogService = createCatalogService({
  Producto, Categoria, ImagenProducto, Variante, ValorVariante, ValorAtributo, Atributo, ReservaStock
});
const catalogController = createCatalogController(catalogService);
const cartValidationService = createCartValidationService({
  Producto, Variante, Categoria, ValorVariante, ValorAtributo, Atributo, ReservaStock
}, { logger: logInventoryInconsistency });
const orderService = createOrderService(
  { Pedido, ItemPedido, HistorialEstadoPedido },
  {
    cartValidationService,
    pickupService: createPickupService({ PuntoRetiro, RetiroEspecial }),
    stockReservationService,
    orderAccessTokens,
    emailOutbox: emailOutboxService
  }
);
// Preparado para la futura ruta de creación; POST /api/orders continúa sin montarse.
app.locals.orderService = orderService;
const cartController = require('./controllers/cartController')(cartValidationService);
const Admin = require('./models/Admin');
const authService = createAuthService({ Admin, env });
const authController = createAuthController(authService);
const authMiddleware = createAuthMiddleware({ secret: env.JWT_SECRET, Admin });
const { authenticate, authorizeAdmin } = authMiddleware;

app.use(helmetMiddleware);
app.use(cors(createCorsOptions(env)));
app.use(createHealthRoutes({ mongoose, logger }));
app.use(express.json({ limit: '10kb' }));
app.use('/api', createApiRateLimiter());
app.use('/api/auth', createAuthRateLimiter(), validateAuthPayload);

// Rutas publicas de consulta del catalogo
app.use('/api', createCatalogRoutes(catalogController));
app.use('/api', createBannerRoutes({ Banner, Configuracion }, { storage: createCloudinaryStorage(env) }));
app.use('/api', createCartRoutes(cartController));
app.use('/api/auth', createAuthRoutes(authController));
// Solo lectura y únicamente mediante token opaco de acceso al pedido; POST /api/orders sigue sin montarse.
app.use('/api/orders', createOrderAccessRoutes(orderAccessController));
// Confirmación interna de transferencias, protegida por autenticación y autorización administrativa reales.
app.use('/api/admin/orders', authenticate, authorizeAdmin, validateJsonBody, createAdminTransferRoutes(createAdminTransferController(transferPaymentService), {
  enabled: env.ADMIN_TRANSFER_CONFIRMATION_ENABLED
}));
app.use('/api/admin/orders', authenticate, authorizeAdmin, validateJsonBody, createAdminOrderRoutes(adminOrderController));
app.use(
  '/api/admin/products',
  authenticate,
  authorizeAdmin,
  validateJsonBody,
  createAdminProductRoutes({
    Producto, Categoria, Variante, ValorVariante, ValorAtributo, Atributo, ImagenProducto
  })
);
app.use(
  '/api/admin/products/:productId/images',
  authenticate,
  authorizeAdmin,
  createAdminImageRoutes(
    { Producto, Variante, ImagenProducto },
    { storage: createCloudinaryStorage(require('./config/env')) }
  )
);
app.use(
  '/api/admin',
  authenticate,
  authorizeAdmin,
  validateJsonBody,
  createAdminAttributeRoutes({ Atributo, ValorAtributo, ValorVariante, ItemPedido, ReservaStock, MovimientoStock })
);
app.use('/api/admin/banners', authenticate, authorizeAdmin, createAdminBannerRoutes(
  { Banner, Configuracion },
  { storage: createCloudinaryStorage(env) }
));
app.use('/api/admin/pickups', authenticate, authorizeAdmin, validateJsonBody,
  createAdminPickupRoutes({ PuntoRetiro, RetiroEspecial, Pedido }));
app.use(
  '/api/admin/products/:productId/variants',
  authenticate,
  authorizeAdmin,
  validateJsonBody,
  createAdminVariantRoutes({ Producto, Variante, Atributo, ValorAtributo, ValorVariante, ItemPedido, ReservaStock, MovimientoStock })
);
app.use(
  '/api/admin/stock',
  authenticate,
  authorizeAdmin,
  createAdminStockRoutes({ Producto, Variante, MovimientoStock, ReservaStock, ValorVariante, ValorAtributo, Atributo }, {
    lowStockThreshold: env.ADMIN_LOW_STOCK_THRESHOLD,
    monitoring: logger,
    logger: logInventoryInconsistency
  })
);
app.use(
  '/api/admin/dashboard',
  authenticate,
  authorizeAdmin,
  createAdminDashboardRoutes({ Pedido, Reintegro, Producto, Variante, ReservaStock }, {
    lowStockThreshold: env.ADMIN_LOW_STOCK_THRESHOLD
  })
);
app.use('/api/pickup-options', createPickupRoutes({ PuntoRetiro, RetiroEspecial }));
// Mercado Pago no usa JWT; la autenticidad se valida con x-signature.
// Los efectos financieros permanecen deshabilitados por configuración segura por defecto.
app.use('/api/webhooks', createWebhookRoutes(mercadoPagoWebhookController));

app.get('/', (req, res) => {
  res.send('\u00a1El backend de Olla Vegana est\u00e1 funcionando perfectamente!');
});

app.use(notFound);
app.use(errorHandler);

module.exports = app;
