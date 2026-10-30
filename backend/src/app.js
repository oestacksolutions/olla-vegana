const express = require('express');
const cors = require('cors');
const Producto = require('./models/Producto');
const Categoria = require('./models/Categoria');
const ImagenProducto = require('./models/ImagenProducto');
const Variante = require('./models/Variante');
const MovimientoStock = require('./models/MovimientoStock');
const ReservaStock = require('./models/ReservaStock');
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
const notFound = require('./middlewares/notFound');
const errorHandler = require('./middlewares/errorHandler');
const env = require('./config/env');

const app = express();
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

// Rate limiters opcionales para rutas API
app.use('/api', createApiRateLimiter());
app.use('/auth', createAuthRateLimiter(), validateAuthPayload);
app.use('/api/auth', createAuthRateLimiter(), validateAuthPayload);

// --- RUTAS PÚBLICAS Y DE CLIENTE (Soportan con y sin /api para compatibilidad total) ---
const catalogRoutes = createCatalogRoutes(catalogController);
const cartRoutes = createCartRoutes(cartController);
const authRoutes = createAuthRoutes(authController);
const pickupRoutes = createPickupRoutes({ PuntoRetiro, RetiroEspecial });

// Montar en raíz (ej: /products, /categories, /auth/login)
app.use('/', catalogRoutes);
app.use('/', cartRoutes);
app.use('/auth', authRoutes);
app.use('/pickup-options', pickupRoutes);

// Montar en /api (ej: /api/products, /api/categories, /api/auth/login)
app.use('/api', catalogRoutes);
app.use('/api', cartRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/pickup-options', pickupRoutes);

// --- RUTAS DE ADMINISTRACIÓN ---
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

app.get('/', (req, res) => {
  res.send('¡El backend de Olla Vegana está funcionando perfectamente!');
});

app.use(notFound);
app.use(errorHandler);

module.exports = app;