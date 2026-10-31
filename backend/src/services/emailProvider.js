const { createSmtpTransport } = require('./emailTransport');

function createEmailProvider(env, { transportFactory = createSmtpTransport } = {}) {
  const enabled = env?.EMAIL_SENDING_ENABLED === true;
  let transport = null;
  return {
    enabled,
    async send(message) {
      if (!enabled) {
        const error = new Error('El envío real de correos está deshabilitado');
        error.code = 'EMAIL_SENDING_DISABLED';
        error.definitive = true;
        throw error;
      }
      transport ||= transportFactory(env);
      try {
        const result = await transport.sendMail({ from: env.MAIL_FROM, ...message });
        return { messageId: result.messageId || null };
      } catch (error) {
        if (Number.isInteger(error?.responseCode) && error.responseCode >= 400 && error.responseCode < 600) {
          error.definitive = true;
        }
        throw error;
      }
    }
  };
}

module.exports = { createEmailProvider };
