const multer = require('multer');
const AppError = require('../utils/AppError');

const MAX_BANNER_FILES = 8;
const MAX_BANNER_FILE_SIZE = 5 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: MAX_BANNER_FILES, fileSize: MAX_BANNER_FILE_SIZE, fields: 2, parts: MAX_BANNER_FILES + 2 },
  fileFilter(_req, file, callback) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      callback(AppError.solicitudInvalida('Solo se admiten imágenes JPG, PNG y WebP'));
      return;
    }
    callback(null, true);
  }
});

function receiveBannerConfig(req, res, next) {
  upload.array('imagenes', MAX_BANNER_FILES)(req, res, next);
}

module.exports = { receiveBannerConfig, MAX_BANNER_FILES, MAX_BANNER_FILE_SIZE };
