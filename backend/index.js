const env = require('./src/config/env');
const app = require('./src/app');
const connectDB = require('./src/config/db');
const logger = require('./src/utils/observability');

async function start() {
  try {
    await connectDB();
    const server = app.listen(env.PORT, () => {
      logger.info('server.started', { port: Number(env.PORT) });
    });

    const shutdown = () => server.close(async () => {
      const mongoose = require('mongoose');
      await mongoose.disconnect();
      process.exit(0);
    });
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  } catch (error) {
    logger.error('server.startup_failed', { category: 'DATABASE', errorCode: String(error?.code || error?.name || 'DATABASE_STARTUP_ERROR') });
    process.exitCode = 1;
  }
}

if (require.main === module) start();

module.exports = start;