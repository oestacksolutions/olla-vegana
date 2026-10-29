const crypto = require('node:crypto');
const AppError = require('../utils/AppError');

function createCloudinaryStorage(config, { fetchImpl = globalThis.fetch } = {}) {
  if (!config) config = require('../config/env');
  const isConfigured = () => Boolean(
    config.CLOUDINARY_CLOUD_NAME && config.CLOUDINARY_API_KEY && config.CLOUDINARY_API_SECRET
  );

  function assertConfigured() {
    if (!isConfigured() || typeof fetchImpl !== 'function') {
      throw new AppError('Servicio de almacenamiento no disponible', 503);
    }
  }

  function signature(parameters) {
    const canonical = Object.keys(parameters).sort()
      .map((key) => `${key}=${parameters[key]}`).join('&');
    return crypto.createHash('sha1')
      .update(`${canonical}${config.CLOUDINARY_API_SECRET}`)
      .digest('hex');
  }

  async function post(endpoint, parameters, file) {
    assertConfigured();
    const form = new FormData();
    for (const [key, value] of Object.entries(parameters)) form.append(key, String(value));
    if (file) form.append('file', new Blob([file.buffer], { type: file.mimetype }));
    form.append('api_key', config.CLOUDINARY_API_KEY);
    form.append('signature', signature(parameters));
    let response;
    try {
      response = await fetchImpl(
        `https://api.cloudinary.com/v1_1/${encodeURIComponent(config.CLOUDINARY_CLOUD_NAME)}/image/${endpoint}`,
        { method: 'POST', body: form, signal: AbortSignal.timeout(20000) }
      );
    } catch (_error) {
      throw new AppError('Servicio de almacenamiento no disponible', 503);
    }
    let body;
    try { body = await response.json(); } catch (_error) { body = null; }
    if (!response.ok || !body) throw new AppError('Servicio de almacenamiento no disponible', 503);
    return body;
  }

  return {
    isConfigured,
    async upload(file, { publicId }) {
      assertConfigured();
      if (!Buffer.isBuffer(file.buffer)) throw AppError.solicitudInvalida('El archivo de imagen no es válido');
      const body = await post('upload', {
        public_id: publicId,
        timestamp: Math.floor(Date.now() / 1000),
        overwrite: false,
        unique_filename: false,
        use_filename: false
      }, file);
      return {
        url: body.secure_url,
        publicId: body.public_id,
        bytes: body.bytes,
        format: body.format
      };
    },
    async remove(publicId) {
      const body = await post('destroy', {
        public_id: publicId,
        timestamp: Math.floor(Date.now() / 1000)
      });
      return body.result === 'ok' || body.result === 'not found';
    }
  };
}

module.exports = { createCloudinaryStorage };
