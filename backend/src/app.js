const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const { createCatalogService } = require('./services/catalogService');
const createCatalogController = require('./controllers/catalogController');
const createCatalogRoutes = require('./routes/catalogRoutes');
const notFound = require('./middlewares/notFound');
const errorHandler = require('./middlewares/errorHandler');

const prisma = new PrismaClient();
const app = express();
const catalogService = createCatalogService(prisma);
const catalogController = createCatalogController(catalogService);

app.use(cors());
app.use(express.json());

// Rutas publicas de consulta del catalogo
app.use('/api', createCatalogRoutes(catalogController));

app.get('/', (req, res) => {
  res.send('\u00a1El backend de Olla Vegana est\u00e1 funcionando perfectamente!');
});

app.use(notFound);
app.use(errorHandler);

module.exports = app;
