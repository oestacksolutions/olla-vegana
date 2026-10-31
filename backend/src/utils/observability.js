const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { createLogger } = require('./logger');
const { createAlertDispatcher } = require('../services/alertDispatcher');

const logger = {
  ...createLogger({
  level: process.env.LOG_LEVEL || 'INFO',
  retentionDays: Number(process.env.LOG_RETENTION_DAYS) || 30
  })
};
logger.alerts = createAlertDispatcher({
  enabled: process.env.ALERTS_ENABLED === 'true',
  webhookUrl: process.env.ALERT_WEBHOOK_URL,
  cooldownMs: (Number(process.env.ALERT_COOLDOWN_SECONDS) || 300) * 1000,
  logger
});
if (process.env.ALERTS_ENABLED === 'true' && !logger.alerts.configured) {
  logger.warn('monitoring.alert_delivery_unconfigured');
}

module.exports = logger;
