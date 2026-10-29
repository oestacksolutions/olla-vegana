const crypto = require('node:crypto');
const mongoose = require('mongoose');
const AppError = require('../utils/AppError');
const { validateObjectId } = require('./adminProductService');

const MAX_IMAGE_COUNT = 5;
const MAX_ALT_LENGTH = 300;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const PUBLIC_IMAGE_FILTER = {
  $or: [{ estadoAlmacenamiento: 'ACTIVA' }, { estadoAlmacenamiento: { $exists: false } }]
};

function invalid(message) { throw AppError.solicitudInvalida(message); }

function runQuery(query, { sort, session, select } = {}) {
  if (sort && query && typeof query.sort === 'function') query = query.sort(sort);
  if (session && query && typeof query.session === 'function') query = query.session(session);
  if (select && query && typeof query.select === 'function') query = query.select(select);
  if (query && typeof query.lean === 'function') query = query.lean();
  return query && typeof query.exec === 'function' ? query.exec() : query;
}

function detectImageType(buffer) {
  if (!Buffer.isBuffer(buffer)) return null;
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

function parseAlignedArray(value, field, count, fallback) {
  if (value === undefined) return Array.from({ length: count }, () => fallback);
  let parsed = value;
  if (typeof parsed === 'string') {
    try { parsed = JSON.parse(parsed); } catch (_error) { invalid(`El campo ${field} debe ser un arreglo JSON válido`); }
  }
  if (!Array.isArray(parsed) || parsed.length !== count) invalid(`El campo ${field} debe tener un valor por cada imagen`);
  return parsed;
}

function validateFiles(files, maxSizeBytes) {
  if (!Array.isArray(files) || files.length === 0) invalid('Debe enviar al menos una imagen');
  if (files.length > MAX_IMAGE_COUNT) invalid(`Se admiten hasta ${MAX_IMAGE_COUNT} imágenes por solicitud`);
  return files.map((file) => {
    const detectedType = detectImageType(file?.buffer);
    if (!detectedType || !ALLOWED_MIME_TYPES.has(detectedType) || file.mimetype !== detectedType) {
      invalid('El contenido del archivo no es una imagen JPG, PNG o WebP válida');
    }
    if (file.buffer.length > maxSizeBytes || (Number.isFinite(file.size) && file.size > maxSizeBytes)) {
      throw new AppError('La imagen supera el tamaño máximo permitido', 413);
    }
    return { file, tipoContenido: detectedType, bytes: file.buffer.length };
  });
}

function safePublicImage(image) {
  return {
    id: String(image._id),
    url: image.url || null,
    posicion: image.posicion,
    esPrincipal: image.esPrincipal === true,
    textoAlternativo: image.textoAlternativo || '',
    varianteId: image.varianteId ? String(image.varianteId) : null,
    estadoAlmacenamiento: image.estadoAlmacenamiento || 'ACTIVA',
    limpiezaPendiente: Boolean(image.estadoAlmacenamiento === 'PENDIENTE_LIMPIEZA' ||
      image.publicIdPendienteEliminar || image.urlPendienteRevision)
  };
}

async function safeUpload(storage, file, options) {
  try { return await storage.upload(file, options); }
  catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Servicio de almacenamiento no disponible', 503);
  }
}

function validateStorageResult(result, expectedPublicId) {
  let url;
  try { url = new URL(result?.url || ''); }
  catch (_error) { throw new AppError('El almacenamiento devolvió una referencia no válida', 503); }
  if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com' || result.publicId !== expectedPublicId) {
    throw new AppError('El almacenamiento devolvió una referencia no válida', 503);
  }
  return url.toString();
}

async function safeRemove(storage, publicId) {
  try {
    if (await storage.remove(publicId)) return true;
  } catch (_error) { /* Convertimos errores del proveedor a un mensaje no sensible. */ }
  throw new AppError('Servicio de almacenamiento no disponible', 503);
}

function createAdminImageService(models, {
  storage,
  startSession = () => mongoose.startSession(),
  maxSizeBytes = 5 * 1024 * 1024,
  idFactory = crypto.randomUUID
} = {}) {
  const { Producto, Variante, ImagenProducto } = models;
  if (!storage || typeof storage.upload !== 'function' || typeof storage.remove !== 'function') {
    throw new TypeError('Se requiere una interfaz de almacenamiento de imágenes');
  }

  async function transaction(operation) {
    const session = await startSession();
    try {
      let result;
      await session.withTransaction(async () => { result = await operation(session); });
      return result;
    } catch (error) {
      if (error && error.code === 11000) throw AppError.conflicto('La galería ya tiene otra imagen principal o un registro duplicado');
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async function requireProduct(productId, session) {
    validateObjectId(productId, 'productId');
    const product = await runQuery(Producto.findById(productId), { session });
    if (!product) throw AppError.noEncontrado('Producto no encontrado');
    return product;
  }

  async function requireImage(productId, imageId, session, includePendingId = false) {
    validateObjectId(imageId, 'imageId');
    const image = await runQuery(
      ImagenProducto.findOne({ _id: imageId, productoId: productId }),
      { session, select: includePendingId ? '+publicIdPendienteEliminar +urlPendienteRevision' : undefined }
    );
    if (!image) throw AppError.noEncontrado('Imagen no encontrada para ese producto');
    return image;
  }

  async function requireVariant(productId, variantId, session) {
    if (variantId === null || variantId === '') return null;
    validateObjectId(variantId, 'varianteId');
    const variant = await runQuery(Variante.findOne({ _id: variantId, productoId: productId }), { session });
    if (!variant) throw AppError.noEncontrado('Variante no encontrada para ese producto');
    return variant._id;
  }

  async function imagesForProduct(productId, session, { activeOnly = false, includePendingId = false } = {}) {
    const images = await runQuery(ImagenProducto.find({ productoId: productId }), {
      sort: { posicion: 1, _id: 1 }, session,
      select: includePendingId ? '+publicIdPendienteEliminar +urlPendienteRevision' : undefined
    });
    return activeOnly
      ? images.filter((image) => image.estadoAlmacenamiento === 'ACTIVA' || image.estadoAlmacenamiento === undefined)
      : images;
  }

  async function listImages(productId) {
    validateObjectId(productId, 'productId');
    await requireProduct(productId);
    return (await imagesForProduct(productId, undefined, { includePendingId: true })).map(safePublicImage);
  }

  async function validateVariantIds(productId, variantIds) {
    const normalized = [];
    for (const id of variantIds) {
      if (id === null || id === undefined || id === '') { normalized.push(null); continue; }
      normalized.push(validateObjectId(id, 'varianteId'));
    }
    const ids = [...new Set(normalized.filter(Boolean))];
    if (!ids.length) return normalized;
    const variants = await runQuery(Variante.find({ _id: { $in: ids }, productoId: productId }));
    if (variants.length !== ids.length) throw AppError.noEncontrado('Una o más variantes no pertenecen al producto');
    return normalized;
  }

  async function removeStagedImages(staged) {
    for (const image of staged) {
      let removed = false;
      try { removed = await storage.remove(image.publicId); } catch (_error) { removed = false; }
      if (removed) {
        try { await ImagenProducto.deleteOne({ _id: image._id, productoId: image.productoId }); }
        catch (_error) {
          try {
            await ImagenProducto.updateOne({ _id: image._id }, { $set: { estadoAlmacenamiento: 'PENDIENTE_LIMPIEZA', esPrincipal: false } });
          } catch (_ignored) { /* El registro PENDIENTE original conserva el ID para reintentar. */ }
        }
      } else {
        try {
          await ImagenProducto.updateOne({ _id: image._id }, { $set: { estadoAlmacenamiento: 'PENDIENTE_LIMPIEZA', esPrincipal: false } });
        } catch (_error) { /* El placeholder PENDIENTE persiste como referencia recuperable. */ }
      }
    }
  }

  async function uploadImages(productId, files, metadata = {}) {
    validateObjectId(productId, 'productId');
    await requireProduct(productId);
    if (storage.isConfigured && !storage.isConfigured()) throw new AppError('Servicio de almacenamiento no disponible', 503);
    const validFiles = validateFiles(files, maxSizeBytes);
    const altTexts = parseAlignedArray(metadata.textosAlternativos, 'textosAlternativos', files.length, '');
    const variantInput = parseAlignedArray(metadata.varianteIds, 'varianteIds', files.length, null);
    const variants = await validateVariantIds(productId, variantInput);
    const names = altTexts.map((value) => {
      if (typeof value !== 'string' || value.trim().length > MAX_ALT_LENGTH) invalid('El texto alternativo no es válido');
      return value.trim();
    });
    const publicIds = validFiles.map(({ tipoContenido }) =>
      `olla-vegana/products/${productId}/${idFactory()}`
    );
    let staged = [];
    let finalized = false;

    try {
      staged = await transaction(async (session) => {
        await requireProduct(productId, session);
        const activeImages = await imagesForProduct(productId, session, { activeOnly: true });
        const nextPosition = activeImages.reduce((max, image) => Math.max(max, Number(image.posicion) || 0), -1) + 1;
        return ImagenProducto.create(validFiles.map((_, index) => ({
          productoId: productId, publicId: publicIds[index], url: null, posicion: nextPosition + index,
          textoAlternativo: names[index], varianteId: variants[index], esPrincipal: false,
          estadoAlmacenamiento: 'PENDIENTE', tipoContenido: validFiles[index].tipoContenido,
          bytes: validFiles[index].bytes
        })), { session });
      });

      const stored = [];
      for (let index = 0; index < validFiles.length; index += 1) {
        const result = await safeUpload(storage, validFiles[index].file, { publicId: publicIds[index], productId });
        stored.push({ ...result, url: validateStorageResult(result, publicIds[index]) });
      }

      await transaction(async (session) => {
        const activeImages = await imagesForProduct(productId, session, { activeOnly: true });
        let alreadyHasMain = activeImages.some((image) => image.esPrincipal === true);
        if (!alreadyHasMain && activeImages.length) {
          await ImagenProducto.updateOne({ _id: activeImages[0]._id, productoId: productId }, {
            $set: { esPrincipal: true }
          }, { session });
          alreadyHasMain = true;
        }
        const nextPosition = activeImages.reduce((max, image) => Math.max(max, Number(image.posicion) || 0), -1) + 1;
        for (let index = 0; index < staged.length; index += 1) {
          await ImagenProducto.updateOne({ _id: staged[index]._id, productoId: productId }, {
            $set: {
              url: stored[index].url, publicId: publicIds[index], estadoAlmacenamiento: 'ACTIVA',
              posicion: nextPosition + index, esPrincipal: !alreadyHasMain && index === 0,
              tipoContenido: validFiles[index].tipoContenido, bytes: validFiles[index].bytes
            }
          }, { session });
        }
      });
      finalized = true;
      return listImages(productId);
    } catch (error) {
      if (staged.length && !finalized) await removeStagedImages(staged);
      throw error;
    }
  }

  async function promoteNextImage(productId, excludedId, session) {
    const candidates = await imagesForProduct(productId, session, { activeOnly: true });
    const candidate = candidates.find((image) => String(image._id) !== String(excludedId));
    if (candidate) {
      await ImagenProducto.updateOne({ _id: candidate._id, productoId: productId }, { $set: { esPrincipal: true } }, { session });
    }
  }

  async function editImage(productId, imageId, input) {
    validateObjectId(productId, 'productId');
    validateObjectId(imageId, 'imageId');
    if (!input || typeof input !== 'object' || Array.isArray(input)) invalid('El cuerpo debe ser un objeto JSON');
    const allowed = ['textoAlternativo', 'posicion', 'esPrincipal', 'varianteId'];
    if (Object.keys(input).some((key) => !allowed.includes(key))) invalid('El cuerpo contiene campos no permitidos');
    if (!Object.keys(input).length) invalid('Debe enviar al menos un campo para editar');
    if (Object.hasOwn(input, 'textoAlternativo') &&
      (typeof input.textoAlternativo !== 'string' || input.textoAlternativo.trim().length > MAX_ALT_LENGTH)) {
      invalid('El texto alternativo no es válido');
    }
    if (Object.hasOwn(input, 'esPrincipal') && typeof input.esPrincipal !== 'boolean') invalid('El campo esPrincipal debe ser booleano');
    if (Object.hasOwn(input, 'posicion') && (!Number.isInteger(input.posicion) || input.posicion < 0)) {
      invalid('La posición debe ser un entero no negativo');
    }
    const variantId = Object.hasOwn(input, 'varianteId') ? input.varianteId : undefined;

    return transaction(async (session) => {
      await requireProduct(productId, session);
      const image = await requireImage(productId, imageId, session);
      if (image.estadoAlmacenamiento && image.estadoAlmacenamiento !== 'ACTIVA') {
        throw AppError.conflicto('La imagen no está disponible para edición');
      }
      const activeImages = await imagesForProduct(productId, session, { activeOnly: true });
      const wasPrincipal = image.esPrincipal === true;
      const update = {};
      if (Object.hasOwn(input, 'textoAlternativo')) update.textoAlternativo = input.textoAlternativo.trim();
      if (variantId !== undefined) update.varianteId = await requireVariant(productId, variantId, session);

      if (Object.hasOwn(input, 'posicion')) {
        if (input.posicion >= activeImages.length) invalid('La posición debe estar dentro del orden actual de la galería');
        const reordered = [...activeImages].sort((a, b) => a.posicion - b.posicion || String(a._id).localeCompare(String(b._id)));
        const [moving] = reordered.splice(reordered.findIndex((item) => String(item._id) === String(imageId)), 1);
        reordered.splice(input.posicion, 0, moving);
        await ImagenProducto.bulkWrite(reordered.map((item, posicion) => ({
          updateOne: { filter: { _id: item._id, productoId: productId }, update: { $set: { posicion } } }
        })), { session });
      }

      if (input.esPrincipal === true) {
        await ImagenProducto.updateMany({ productoId: productId, esPrincipal: true, _id: { $ne: imageId } }, {
          $set: { esPrincipal: false }
        }, { session });
        update.esPrincipal = true;
      } else if (input.esPrincipal === false && image.esPrincipal === true) {
        update.esPrincipal = false;
      }

      await ImagenProducto.findOneAndUpdate({ _id: imageId, productoId: productId }, { $set: update }, {
        new: true, runValidators: true, session
      });
      if (input.esPrincipal === false && wasPrincipal) await promoteNextImage(productId, imageId, session);
      const fresh = await requireImage(productId, imageId, session);
      return safePublicImage(fresh);
    });
  }

  async function reorderImages(productId, imageIds) {
    validateObjectId(productId, 'productId');
    if (!Array.isArray(imageIds) || imageIds.length === 0) invalid('Debe enviar el orden completo de la galería');
    const normalized = imageIds.map((id) => validateObjectId(id, 'imageId'));
    if (new Set(normalized).size !== normalized.length) invalid('No se pueden repetir imágenes en el orden');
    return transaction(async (session) => {
      await requireProduct(productId, session);
      const images = await imagesForProduct(productId, session, { activeOnly: true });
      const current = new Set(images.map((image) => String(image._id)));
      if (normalized.length !== current.size || normalized.some((id) => !current.has(id))) {
        invalid('El orden debe incluir todas las imágenes activas del producto exactamente una vez');
      }
      const byId = new Map(images.map((image) => [String(image._id), image]));
      await ImagenProducto.bulkWrite(normalized.map((id, posicion) => ({
        updateOne: { filter: { _id: byId.get(id)._id, productoId: productId }, update: { $set: { posicion } } }
      })), { session });
      return normalized.map((id, posicion) => ({ ...safePublicImage(byId.get(id)), posicion }));
    });
  }

  async function cleanupPreviousFile(image) {
    if (!image.publicIdPendienteEliminar) return image;
    await safeRemove(storage, image.publicIdPendienteEliminar);
    await ImagenProducto.updateOne({ _id: image._id }, { $set: { publicIdPendienteEliminar: null } });
    return { ...image, publicIdPendienteEliminar: null };
  }

  async function replaceImage(productId, imageId, file) {
    validateObjectId(productId, 'productId');
    validateObjectId(imageId, 'imageId');
    const [validFile] = validateFiles([file], maxSizeBytes);
    const publicId = `olla-vegana/products/${productId}/${idFactory()}`;
    await requireProduct(productId);
    let original = await requireImage(productId, imageId, undefined, true);
    if (original.estadoAlmacenamiento && original.estadoAlmacenamiento !== 'ACTIVA') {
      throw AppError.conflicto('La imagen no está disponible para reemplazo');
    }
    if (original.urlPendienteRevision) {
      throw AppError.conflicto('La imagen conserva una URL anterior pendiente de revisión manual');
    }
    if (storage.isConfigured && !storage.isConfigured()) throw new AppError('Servicio de almacenamiento no disponible', 503);
    original = await cleanupPreviousFile(original);

    const [staged] = await transaction(async (session) => {
      const current = await requireImage(productId, imageId, session, true);
      if (current.estadoAlmacenamiento && current.estadoAlmacenamiento !== 'ACTIVA') {
        throw AppError.conflicto('La imagen no está disponible para reemplazo');
      }
      if (current.publicIdPendienteEliminar || current.urlPendienteRevision) {
        throw AppError.conflicto('La imagen requiere limpieza o revisión antes de reemplazarse');
      }
      return ImagenProducto.create([{
        productoId: productId, publicId, url: null, posicion: current.posicion,
        esPrincipal: false, varianteId: current.varianteId,
        estadoAlmacenamiento: 'PENDIENTE', tipoContenido: validFile.tipoContenido, bytes: validFile.bytes
      }], { session });
    });
    let committed = false;
    let previousPublicId = null;
    try {
      const stored = await safeUpload(storage, validFile.file, { publicId, productId });
      const url = validateStorageResult(stored, publicId);
      await transaction(async (session) => {
        const current = await requireImage(productId, imageId, session, true);
        if (current.estadoAlmacenamiento && current.estadoAlmacenamiento !== 'ACTIVA') {
          throw AppError.conflicto('La imagen dejó de estar disponible para reemplazo');
        }
        if (current.publicIdPendienteEliminar) {
          throw AppError.conflicto('La imagen tiene una limpieza anterior pendiente');
        }
        previousPublicId = current.publicId;
        await ImagenProducto.findOneAndUpdate({ _id: imageId, productoId: productId }, { $set: {
          url: url.toString(), publicId,
          publicIdPendienteEliminar: previousPublicId || null,
          urlPendienteRevision: previousPublicId ? null : (current.url || null),
          estadoAlmacenamiento: 'ACTIVA', tipoContenido: validFile.tipoContenido, bytes: validFile.bytes
        } }, { new: true, runValidators: true, session });
        await ImagenProducto.deleteOne({ _id: staged._id, productoId: productId }, { session });
      });
      committed = true;
    } catch (error) {
      if (!committed) await removeStagedImages([staged]);
      throw error;
    }

    if (previousPublicId) {
      try {
        await safeRemove(storage, previousPublicId);
        await ImagenProducto.updateOne({ _id: imageId }, { $set: { publicIdPendienteEliminar: null } });
      } catch (_error) { /* El ID anterior queda persistido para reintento. */ }
    }
    return safePublicImage(await requireImage(productId, imageId));
  }

  async function deleteImage(productId, imageId) {
    validateObjectId(productId, 'productId');
    validateObjectId(imageId, 'imageId');
    let image = await transaction(async (session) => {
      await requireProduct(productId, session);
      const current = await requireImage(productId, imageId, session, true);
      if (current.urlPendienteRevision) {
        throw AppError.conflicto('La imagen conserva una URL anterior pendiente de revisión manual');
      }
      if (current.estadoAlmacenamiento !== 'PENDIENTE_LIMPIEZA') {
        if (!current.publicId && current.url) {
          throw AppError.conflicto('La imagen no tiene identificador de almacenamiento; requiere revisión antes de eliminarse');
        }
        const wasPrincipal = current.esPrincipal === true;
        await ImagenProducto.updateOne({ _id: imageId, productoId: productId }, {
          $set: { estadoAlmacenamiento: 'PENDIENTE_LIMPIEZA', esPrincipal: false }
        }, { session });
        if (wasPrincipal) await promoteNextImage(productId, imageId, session);
      }
      return current;
    });

    const externalIds = [...new Set([image.publicIdPendienteEliminar, image.publicId].filter(Boolean))];
    if (!externalIds.length && image.url) {
      throw AppError.conflicto('La imagen no tiene identificador de almacenamiento; requiere revisión antes de eliminarse');
    }
    for (const publicId of externalIds) {
      await safeRemove(storage, publicId);
      if (publicId === image.publicIdPendienteEliminar) {
        await ImagenProducto.updateOne({ _id: imageId }, { $set: { publicIdPendienteEliminar: null } });
        image = { ...image, publicIdPendienteEliminar: null };
      }
    }
    await ImagenProducto.deleteOne({ _id: imageId, productoId: productId });
    return { id: String(imageId), eliminada: true };
  }

  return { listImages, uploadImages, editImage, reorderImages, replaceImage, deleteImage };
}

module.exports = { createAdminImageService, detectImageType, validateFiles, MAX_IMAGE_COUNT, PUBLIC_IMAGE_FILTER };
