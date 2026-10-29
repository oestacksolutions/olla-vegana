const multer = require('multer');
const AppError = require('../utils/AppError');

const MAX_IMAGE_COUNT = 5;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const configuredSize = Number(process.env.IMAGE_MAX_SIZE_BYTES);
const MAX_IMAGE_SIZE_BYTES = Number.isSafeInteger(configuredSize) && configuredSize > 0
  && configuredSize <= 20 * 1024 * 1024
  ? configuredSize
  : 5 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: MAX_IMAGE_COUNT,
    fileSize: MAX_IMAGE_SIZE_BYTES,
    fields: 3,
    parts: MAX_IMAGE_COUNT + 3
  },
  fileFilter(_req, file, callback) {
    if (!ALLOWED_TYPES.has(file.mimetype)) {
      callback(AppError.solicitudInvalida('Solo se admiten imágenes JPG, PNG y WebP'));
      return;
    }
    callback(null, true);
  }
});

function receiveGalleryImages(req, res, next) {
  upload.array('imagenes', MAX_IMAGE_COUNT)(req, res, next);
}

function receiveReplacementImage(req, res, next) {
  upload.single('imagen')(req, res, next);
}

module.exports = { receiveGalleryImages, receiveReplacementImage, MAX_IMAGE_COUNT };
