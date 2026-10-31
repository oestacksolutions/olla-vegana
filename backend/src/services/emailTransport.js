const AppError = require('../utils/AppError');

function createSmtpTransport(env, nodemailer = require('nodemailer')) {
  if (!env?.SMTP_HOST || !env?.SMTP_PORT || !env?.SMTP_USER || !env?.SMTP_PASS || !env?.MAIL_FROM) {
    throw new AppError('El servicio de correo no está configurado.', 503);
  }
  const port = Number(env.SMTP_PORT);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new AppError('La configuración del servicio de correo no es válida.', 503);
  }
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    tls: { minVersion: 'TLSv1.2' },
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS }
  });
}

module.exports = { createSmtpTransport };
