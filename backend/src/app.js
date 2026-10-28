const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const asyncHandler = require('./utils/asyncHandler');
const notFound = require('./middlewares/notFound');
const errorHandler = require('./middlewares/errorHandler');

const prisma = new PrismaClient();
const app = express();

app.use(cors());
app.use(express.json());

// Rutas de la API
app.get('/api/products', asyncHandler(async (req, res) => {
  const producto = await prisma.producto.findMany({
    where: { activo: true }
  });
  res.json(producto);
}));

app.get('/', (req, res) => {
  res.send('\u00a1El backend de Olla Vegana est\u00e1 funcionando perfectamente!');
});

app.use(notFound);
app.use(errorHandler);

module.exports = app;
