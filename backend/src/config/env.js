const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const required = ['DATABASE_URL', 'JWT_SECRET'];
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

module.exports = {
  DATABASE_URL: process.env.DATABASE_URL,
  PORT: process.env.PORT || 3001,
  NODE_ENV: process.env.NODE_ENV || 'development',
  FRONTEND_URL: process.env.FRONTEND_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  MP_ACCESS_TOKEN: process.env.MP_ACCESS_TOKEN,
  MP_WEBHOOK_SECRET: process.env.MP_WEBHOOK_SECRET,
  MP_PUBLIC_KEY: process.env.MP_PUBLIC_KEY,
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  MAIL_FROM: process.env.MAIL_FROM
};
