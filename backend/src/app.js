const express = require('express');
const cors = require('cors');
const Producto = require('./models/Producto');
const Categoria = require('./models/Categoria');
const ImagenProducto = require('./models/ImagenProducto');
const Variante = require('./models/Variante');
const ValorVariante = require('./models/ValorVariante');
const ValorAtributo = require('./models/ValorAtributo');
const Atributo = require('./models/Atributo');
const ReservaStock = require('./models/ReservaStock');
const PuntoRetiro = require('./models/PuntoRetiro');
const RetiroEspecial = require('./models/RetiroEspecial');
const { createCatalogService } = require('./services/catalogService');
const { createAuthService } = require('./services/authService');
const createCatalogController = require('./controllers/catalogController');
const createAuthController = require('./controllers/authController');
const createCatalogRoutes = require('./routes/catalogRoutes');
const createAuthRoutes = require('./routes/authRoutes');
const createAdminProductRoutes = require('./routes/adminProductRoutes');
const { createAuthMiddleware } = require('./middlewares/auth');
const createPickupRoutes = require('./routes/pickupRoutes');
const notFound = require('./middlewares/notFound');
const errorHandler = require('./middlewares/errorHandler');

const app = express();
const catalogService = createCatalogService({
  Producto, Categoria, ImagenProducto, Variante, ValorVariante, ValorAtributo, Atributo, ReservaStock
});
const catalogController = createCatalogController(catalogService);
const authService = createAuthService({ Admin: require('./models/Admin'), env: require('./config/env') });
const authController = createAuthController(authService);
const Admin = require('./models/Admin');
const { authenticate, authorizeAdmin } = createAuthMiddleware({
  secret: require('./config/env').JWT_SECRET,
  Admin
});

app.use(cors());
app.use(express.json());

// Rutas publicas de consulta del catalogo
app.use('/api', createCatalogRoutes(catalogController));
app.use('/api/auth', createAuthRoutes(authController));
app.use(
  '/api/admin/products',
  authenticate,
  authorizeAdmin,
  createAdminProductRoutes({
    Producto, Categoria, Variante, ValorVariante, ValorAtributo, Atributo, ImagenProducto
  })
);
app.use('/api/pickup-options', createPickupRoutes({ PuntoRetiro, RetiroEspecial }));

app.get('/', (req, res) => {
  res.send('\u00a1El backend de Olla Vegana est\u00e1 funcionando perfectamente!');
});

app.use(notFound);
app.use(errorHandler);

module.exports = app;
