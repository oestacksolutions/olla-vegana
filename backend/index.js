const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const env = require('./src/config/env');

const prisma = new PrismaClient();
const app = express();

// Middlewares
app.use(cors()); // Permite que tu frontend se conecte sin errores de seguridad
app.use(express.json()); // Permite leer los datos (JSON) que envíe el carrito

// ==========================================
// RUTAS DE LA API
// ==========================================

// Ruta 1: Obtener todos los productos activos
app.get('/api/products', async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { isActive: true }
    });
    res.json(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener los productos" });
  }
});

// Ruta 2: Ruta de prueba para saber que el servidor funciona
app.get('/', (req, res) => {
  res.send('¡El backend de Olla Vegana está funcionando perfectamente!');
});

// ==========================================
// INICIAR SERVIDOR
// ==========================================
const PORT = env.PORT;

app.listen(PORT, () => {
  console.log(`🚀 Servidor de Olla Vegana corriendo en: http://localhost:${PORT}`);
});
