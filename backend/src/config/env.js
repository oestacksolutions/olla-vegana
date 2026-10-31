const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const required = ['MONGODB_URI', 'JWT_SECRET'];
for (const name of required) {
  if (!process.env[name]) {
    console.error(`Falta la variable obligatoria ${name} en backend/.env.`);
    process.exit(1);
  }
}

if (process.env.JWT_SECRET.length < 32) {
  console.error('La variable JWT_SECRET debe tener al menos 32 caracteres.');
  process.exit(1);
}

const optionalIntegrations = [
  'MP_ACCESS_TOKEN',
  'MP_WEBHOOK_SECRET',
  'MP_PUBLIC_KEY',
  'MP_ENVIRONMENT',
  'MP_ORDER_CREATION_ENABLED',
  'MP_ORDER_FLOW_READY',
  'MP_WEBHOOKS_READY',
  'MP_WEBHOOK_EFFECTS_ENABLED',
  'MP_REFUND_OPERATIONS_ENABLED',
  'MP_ORDER_CANCELLATION_ENABLED',
  'ADMIN_ORDER_STATUS_CHANGES_ENABLED',
  'ADMIN_TRANSFER_CONFIRMATION_ENABLED',
  'MP_APPLICATION_ID',
  'MP_USER_ID',
  'FRONTEND_PUBLIC_URL',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'MAIL_FROM',
  'EMAIL_SENDING_ENABLED'
];
for (const name of optionalIntegrations) {
  if (!process.env[name]) {
    console.warn(`Advertencia: falta la variable opcional ${name}.`);
  }
}

const cloudinaryConfig = {
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET
};
if (!Object.values(cloudinaryConfig).every(Boolean)) {
  console.warn('Advertencia: Cloudinary no está configurado por completo; las cargas de imágenes no estarán disponibles.');
}

const imageMaxSizeBytes = Number(process.env.IMAGE_MAX_SIZE_BYTES);
const logLevel = (process.env.LOG_LEVEL || 'INFO').toUpperCase();
if (!['INFO', 'WARN', 'ERROR'].includes(logLevel)) {
  console.error('LOG_LEVEL debe ser INFO, WARN o ERROR.');
  process.exit(1);
}
const logRetentionDays = process.env.LOG_RETENTION_DAYS === undefined ? 30 : Number(process.env.LOG_RETENTION_DAYS);
if (!Number.isSafeInteger(logRetentionDays) || logRetentionDays < 1 || logRetentionDays > 3650) {
  console.error('LOG_RETENTION_DAYS debe ser un entero entre 1 y 3650.');
  process.exit(1);
}
const alertCooldownSeconds = process.env.ALERT_COOLDOWN_SECONDS === undefined ? 300 : Number(process.env.ALERT_COOLDOWN_SECONDS);
if (!Number.isSafeInteger(alertCooldownSeconds) || alertCooldownSeconds < 30 || alertCooldownSeconds > 86400) {
  console.error('ALERT_COOLDOWN_SECONDS debe ser un entero entre 30 y 86400.');
  process.exit(1);
}
const lowStockThreshold = process.env.ADMIN_LOW_STOCK_THRESHOLD === undefined
  ? 5
  : Number(process.env.ADMIN_LOW_STOCK_THRESHOLD);
if (!Number.isSafeInteger(lowStockThreshold) || lowStockThreshold < 0) {
  console.error('ADMIN_LOW_STOCK_THRESHOLD debe ser un entero no negativo.');
  process.exit(1);
}
module.exports = {
  MONGODB_URI: process.env.MONGODB_URI,
  PORT: process.env.PORT || 3001,
  NODE_ENV: process.env.NODE_ENV || 'development',
  FRONTEND_URL: process.env.FRONTEND_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  MP_ACCESS_TOKEN: process.env.MP_ACCESS_TOKEN,
  MP_WEBHOOK_SECRET: process.env.MP_WEBHOOK_SECRET,
  MP_PUBLIC_KEY: process.env.MP_PUBLIC_KEY,
  MP_ENVIRONMENT: process.env.MP_ENVIRONMENT || 'test',
  MP_ORDER_CREATION_ENABLED: process.env.MP_ORDER_CREATION_ENABLED === 'true',
  MP_ORDER_FLOW_READY: process.env.MP_ORDER_FLOW_READY === 'true',
  MP_WEBHOOKS_READY: process.env.MP_WEBHOOKS_READY === 'true',
  MP_WEBHOOK_EFFECTS_ENABLED: process.env.MP_WEBHOOK_EFFECTS_ENABLED === 'true',
  MP_REFUND_OPERATIONS_ENABLED: process.env.MP_REFUND_OPERATIONS_ENABLED === 'true',
  MP_ORDER_CANCELLATION_ENABLED: process.env.MP_ORDER_CANCELLATION_ENABLED === 'true',
  ADMIN_ORDER_STATUS_CHANGES_ENABLED: process.env.ADMIN_ORDER_STATUS_CHANGES_ENABLED === 'true',
  ADMIN_TRANSFER_CONFIRMATION_ENABLED: process.env.ADMIN_TRANSFER_CONFIRMATION_ENABLED === 'true',
  MP_APPLICATION_ID: process.env.MP_APPLICATION_ID,
  MP_USER_ID: process.env.MP_USER_ID,
  FRONTEND_PUBLIC_URL: process.env.FRONTEND_PUBLIC_URL,
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  MAIL_FROM: process.env.MAIL_FROM,
  EMAIL_SENDING_ENABLED: process.env.EMAIL_SENDING_ENABLED === 'true',
  ALERT_WEBHOOK_URL: process.env.ALERT_WEBHOOK_URL,
  ALERT_COOLDOWN_SECONDS: alertCooldownSeconds,
  LOG_LEVEL: logLevel,
  LOG_RETENTION_DAYS: logRetentionDays,
  ALERTS_ENABLED: process.env.ALERTS_ENABLED === 'true',
  ...cloudinaryConfig,
  IMAGE_MAX_SIZE_BYTES: Number.isSafeInteger(imageMaxSizeBytes) && imageMaxSizeBytes > 0 && imageMaxSizeBytes <= 20 * 1024 * 1024
    ? imageMaxSizeBytes
    : 5 * 1024 * 1024,
  ADMIN_LOW_STOCK_THRESHOLD: lowStockThreshold
};
