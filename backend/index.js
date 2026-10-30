const env = require('./src/config/env');
const app = require('./src/app');
const connectDB = require('./src/config/db');

async function start() {
  try {
    await connectDB();
    const server = app.listen(env.PORT, () => {
      console.log(`Servidor de Olla Vegana corriendo en el puerto ${env.PORT}`);
    });

    const shutdown = () => server.close(async () => {
      const mongoose = require('mongoose');
      await mongoose.disconnect();
      process.exit(0);
    });
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  } catch (_error) {
    console.error('No se pudo conectar a MongoDB; el servidor no se inició.');
    process.exitCode = 1;
  }
}

if (require.main === module) start();

module.exports = start;