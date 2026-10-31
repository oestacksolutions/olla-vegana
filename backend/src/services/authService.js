const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const AppError = require('../utils/AppError');
const { createSmtpTransport } = require('./emailTransport');

const PASSWORD_HASH_PREFIX = 'scrypt';
const BCRYPT_ROUNDS = 12;
const SESSION_TTL_SECONDS = 8 * 60 * 60;
const RESET_TOKEN_TTL_MS = 15 * 60 * 1000;

function base64Url(value) {
  return Buffer.from(value).toString('base64url');
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(`${PASSWORD_HASH_PREFIX}$${salt.toString('base64url')}$${derivedKey.toString('base64url')}`);
    });
  });
}

function verifyPassword(password, storedHash) {
  if (typeof password !== 'string' || !storedHash?.startsWith(`${PASSWORD_HASH_PREFIX}$`)) return false;
  const [, encodedSalt, encodedHash] = storedHash.split('$');
  if (!encodedSalt || !encodedHash) return false;

  const salt = Buffer.from(encodedSalt, 'base64url');
  const expected = Buffer.from(encodedHash, 'base64url');
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, expected.length, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(crypto.timingSafeEqual(expected, derivedKey));
    });
  });
}

function signToken(payload, secret) {
  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64Url(JSON.stringify(payload));
  const signature = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

function normalizeEmail(correo) {
  return typeof correo === 'string' ? correo.trim().toLowerCase() : '';
}

function validateNewPassword(contrasena) {
  if (typeof contrasena !== 'string' || contrasena.length < 12) {
    throw AppError.solicitudInvalida('La contraseña debe tener al menos 12 caracteres.');
  }
}

function isBcryptHash(value) {
  return typeof value === 'string' && /^\$2[aby]\$\d{2}\$/.test(value);
}

function createAuthService({ Admin, env, now = () => Date.now() }) {
  if (!Admin || !env?.JWT_SECRET) throw new TypeError('La autenticación requiere Admin y una clave JWT');
  return {
    async login(correo, contrasena) {
      const normalizedEmail = normalizeEmail(correo);
      if (!normalizedEmail || typeof contrasena !== 'string') {
        throw AppError.noAutorizado('El correo o la contraseña no son correctos.');
      }
      const admin = await Admin.findOne({ correo: normalizedEmail, activo: true }).select('+contrasena');
      const validPassword = admin
        && (isBcryptHash(admin.contrasena)
          ? await bcrypt.compare(contrasena, admin.contrasena)
          : await verifyPassword(contrasena, admin.contrasena));

      if (!validPassword) throw AppError.noAutorizado('El correo o la contraseña no son correctos.');

      const nowMs = now();
      const token = signToken({
        sub: String(admin._id),
        adminUpdatedAt: admin.updatedAt instanceof Date ? admin.updatedAt.getTime() : 0,
        jti: crypto.randomBytes(16).toString('hex'),
        iat: Math.floor(nowMs / 1000),
        exp: Math.floor(nowMs / 1000) + SESSION_TTL_SECONDS
      }, env.JWT_SECRET);

      return { token, admin: { id: String(admin._id), correo: admin.correo } };
    },

    async requestPasswordReset(correo) {
      const normalizedEmail = normalizeEmail(correo);
      const admin = normalizedEmail
        ? await Admin.findOne({ correo: normalizedEmail, activo: true }).select('+resetPasswordToken +resetPasswordExpires')
        : null;

      if (admin) {
        const rawToken = crypto.randomBytes(32).toString('hex');
        admin.resetPasswordToken = crypto.createHash('sha256').update(rawToken).digest('hex');
        admin.resetPasswordExpires = new Date(Date.now() + RESET_TOKEN_TTL_MS);
        await admin.save();

        const resetUrl = `${env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${encodeURIComponent(rawToken)}`;
        if (env.SMTP_HOST && env.SMTP_PORT && env.SMTP_USER && env.SMTP_PASS && env.MAIL_FROM) {
          try {
            const transport = createSmtpTransport(env);
            await transport.sendMail({
              from: env.MAIL_FROM,
              to: admin.correo,
              subject: 'Restablecer acceso a Olla Vegana',
              text: `Solicitaste restablecer tu contraseña. Abrí este enlace dentro de los próximos 15 minutos: ${resetUrl}\n\nSi no realizaste esta solicitud, ignorá este correo.`
            });
          } catch (error) {
            console.error('[auth] No se pudo enviar el correo de recuperación.', error);
          }
        } else if (env.NODE_ENV === 'development') {
          console.info(`[auth] Enlace de recuperación generado para desarrollo: ${resetUrl}`);
        }
      }

      return { message: 'Si el correo está registrado, recibirás instrucciones para restablecer tu contraseña.' };
    },

    async resetPassword(rawToken, contrasena) {
      validateNewPassword(contrasena);
      if (typeof rawToken !== 'string' || rawToken.length < 20) {
        throw AppError.solicitudInvalida('El enlace de recuperación no es válido.');
      }

      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const admin = await Admin.findOne({
        resetPasswordToken: tokenHash,
        resetPasswordExpires: { $gt: new Date() },
        activo: true
      }).select('+contrasena +resetPasswordToken +resetPasswordExpires');

      if (!admin) throw AppError.solicitudInvalida('El enlace de recuperación no es válido o ya venció.');

      admin.contrasena = await bcrypt.hash(contrasena, BCRYPT_ROUNDS);
      admin.resetPasswordToken = undefined;
      admin.resetPasswordExpires = undefined;
      await admin.save();
      return { message: 'Contraseña actualizada correctamente.' };
    }
  };
}

module.exports = { createAuthService, hashPassword, verifyPassword, signToken, SESSION_TTL_SECONDS };
