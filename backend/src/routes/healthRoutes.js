const express = require('express');

function createHealthRoutes({ mongoose, logger }) {
  const router = express.Router();
  router.get('/health/live', (_req, res) => res.status(200).json({ status: 'ok' }));
  router.get('/health/ready', async (_req, res) => {
    try {
      if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
        return res.status(503).json({ status: 'not_ready', dependencies: { database: 'unavailable' } });
      }
      await mongoose.connection.db.admin().ping({ maxTimeMS: 1000 });
      return res.status(200).json({ status: 'ready', dependencies: { database: 'available' } });
    } catch {
      logger?.warn('health.readiness.failed', { dependency: 'database' });
      return res.status(503).json({ status: 'not_ready', dependencies: { database: 'unavailable' } });
    }
  });
  return router;
}

module.exports = createHealthRoutes;
