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
  'MP_APPLICATION_ID',
  'MP_USER_ID',
  'FRONTEND_PUBLIC_URL',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'MAIL_FROM'
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
  MP_APPLICATION_ID: process.env.MP_APPLICATION_ID,
  MP_USER_ID: process.env.MP_USER_ID,
  FRONTEND_PUBLIC_URL: process.env.FRONTEND_PUBLIC_URL,
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  MAIL_FROM: process.env.MAIL_FROM,
  ...cloudinaryConfig,
  IMAGE_MAX_SIZE_BYTES: Number.isSafeInteger(imageMaxSizeBytes) && imageMaxSizeBytes > 0 && imageMaxSizeBytes <= 20 * 1024 * 1024
    ? imageMaxSizeBytes
    : 5 * 1024 * 1024
};
