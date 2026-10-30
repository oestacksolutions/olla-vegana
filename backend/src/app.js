const express = require('express');
const cors = require('cors');
const Producto = require('./models/Producto');
const Categoria = require('./models/Categoria');
const ImagenProducto = require('./models/ImagenProducto');
const Variante = require('./models/Variante');
const MovimientoStock = require('./models/MovimientoStock');
const ReservaStock = require('./models/ReservaStock');
const Pedido = require('./models/Pedido');
const HistorialEstadoPedido = require('./models/HistorialEstadoPedido');
const IntentoPago = require('./models/IntentoPago');
const EventoPago = require('./models/EventoPago');
const ValorVariante = require('./models/ValorVariante');
const ValorAtributo = require('./models/ValorAtributo');
const Atributo = require('./models/Atributo');
const PuntoRetiro = require('./models/PuntoRetiro');
const RetiroEspecial = require('./models/RetiroEspecial');
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
const { createStockReservationService } = require('./services/stockReservationService');
const notFound = require('./middlewares/notFound');
const errorHandler = require('./middlewares/errorHandler');
const env = require('./config/env');

const app = express();
const paymentAuthorization = createPaymentAuthorization();
const stockReservationService = createStockReservationService(
  { Pedido, Variante, ReservaStock, MovimientoStock, HistorialEstadoPedido },
  { verifyPaymentAuthorization: paymentAuthorization.verify }
);
const mercadoPagoWebhookService = createMercadoPagoWebhookService(
  { Pedido, IntentoPago, EventoPago },
  {
    env,
    orderClient: createMercadoPagoOrderClient({ accessToken: env.MP_ACCESS_TOKEN }),
    stockReservationService,
    paymentAuthorization
  }
);
const mercadoPagoWebhookController = createMercadoPagoWebhookController(mercadoPagoWebhookService);
const catalogService = createCatalogService({
  Producto, Categoria, ImagenProducto, Variante, ValorVariante, ValorAtributo, Atributo, ReservaStock
});
const catalogController = createCatalogController(catalogService);
const cartValidationService = createCartValidationService({
  Producto, Variante, Categoria, ValorVariante, ValorAtributo, Atributo, ReservaStock
});
const cartController = require('./controllers/cartController')(cartValidationService);
const authService = createAuthService({ Admin: require('./models/Admin'), env: require('./config/env') });
const authController = createAuthController(authService);
const Admin = require('./models/Admin');
const { authenticate, authorizeAdmin } = createAuthMiddleware({
  secret: require('./config/env').JWT_SECRET,
  Admin
});

app.use(helmetMiddleware);
app.use(cors(createCorsOptions(env)));
app.use(express.json({ limit: '10kb' }));
app.use('/api', createApiRateLimiter());
app.use('/api/auth', createAuthRateLimiter(), validateAuthPayload);

// Rutas publicas de consulta del catalogo
app.use('/api', createCatalogRoutes(catalogController));
app.use('/api', createCartRoutes(cartController));
app.use('/api/auth', createAuthRoutes(authController));
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
  '/api/admin/stock',
  authenticate,
  authorizeAdmin,
  createAdminStockRoutes({ Producto, Variante, MovimientoStock, ReservaStock, ValorVariante, ValorAtributo, Atributo })
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
