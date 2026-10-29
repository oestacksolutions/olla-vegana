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
const createCatalogController = require('./controllers/catalogController');
const createCatalogRoutes = require('./routes/catalogRoutes');
const createPickupRoutes = require('./routes/pickupRoutes');
const notFound = require('./middlewares/notFound');
const errorHandler = require('./middlewares/errorHandler');

const app = express();
const catalogService = createCatalogService({
  Producto, Categoria, ImagenProducto, Variante, ValorVariante, ValorAtributo, Atributo, ReservaStock
});
const catalogController = createCatalogController(catalogService);

app.use(cors());
app.use(express.json());

// Rutas publicas de consulta del catalogo
app.use('/api', createCatalogRoutes(catalogController));
app.use('/api/pickup-options', createPickupRoutes({ PuntoRetiro, RetiroEspecial }));

app.get('/', (req, res) => {
  res.send('\u00a1El backend de Olla Vegana est\u00e1 funcionando perfectamente!');
});

app.use(notFound);
app.use(errorHandler);

module.exports = app;
