const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Variante = require('../src/models/Variante');
const ImagenProducto = require('../src/models/ImagenProducto');
const { createAdminImageService, detectImageType } = require('../src/services/adminImageService');
const { createCloudinaryStorage } = require('../src/services/cloudinaryStorage');
const createAdminImageRoutes = require('../src/routes/adminImageRoutes');
const { MAX_IMAGE_COUNT } = require('../src/middlewares/imageUpload');
const errorHandler = require('../src/middlewares/errorHandler');

const PRODUCT = '507f1f77bcf86cd799439011';
const OTHER_PRODUCT = '507f1f77bcf86cd799439021';
const VARIANT = '507f1f77bcf86cd799439012';
const OTHER_VARIANT = '507f1f77bcf86cd799439022';
const IMAGE_A = '507f1f77bcf86cd799439013';
const IMAGE_B = '507f1f77bcf86cd799439014';
const IMAGE_C = '507f1f77bcf86cd799439015';

function queryResult(data) {
  return {
    sort(sortSpec) {
      const [[field, direction]] = Object.entries(sortSpec);
      data.sort((left, right) => (left[field] > right[field] ? 1 : left[field] < right[field] ? -1 : 0) * direction);
      return this;
    },
    session() { return this; },
    select() { return this; },
    lean() { return this; },
    exec: async () => data
  };
}

function matches(document, filter) {
  if (filter.$or && !filter.$or.some((branch) => matches(document, branch))) return false;
  return Object.entries(filter).every(([field, expected]) => {
    if (field === '$or') return true;
    const actual = document[field];
    if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
      if (expected.$in) return expected.$in.some((value) => String(value) === String(actual));
      if (expected.$ne !== undefined) return String(expected.$ne) !== String(actual);
      if (expected.$exists !== undefined) return expected.$exists ? actual !== undefined : actual === undefined;
    }
    return String(actual) === String(expected);
  });
}

function makeSetup({ images = [], variants = [{ _id: VARIANT, productoId: PRODUCT }], product = { _id: PRODUCT }, failUpdate = 0 } = {}) {
  const data = { images: images.map((image) => ({ estadoAlmacenamiento: 'ACTIVA', esPrincipal: false, ...image })) };
  let nextObjectId = 30;
  let updateFailures = failUpdate;
  const session = { withTransaction: async (operation) => operation(), endSession: async () => {} };
  const applyUpdate = (doc, update) => Object.assign(doc, update.$set || update);
  const checkPrincipal = (doc, update) => {
    const set = update.$set || update;
    if (set.esPrincipal === true && data.images.some((other) => other !== doc &&
      String(other.productoId) === String(doc.productoId) && other.esPrincipal === true)) {
      const error = new Error('duplicate key'); error.code = 11000; throw error;
    }
  };
  const models = {
    Producto: { findById: (id) => queryResult(String(id) === String(product?._id) ? product : null) },
    Variante: {
      findOne: (filter) => queryResult(variants.find((variant) => matches(variant, filter)) || null),
      find: (filter) => queryResult(variants.filter((variant) => matches(variant, filter)))
    },
    ImagenProducto: {
      find: (filter) => queryResult(data.images.filter((image) => matches(image, filter))),
      findOne: (filter) => queryResult(data.images.find((image) => matches(image, filter)) || null),
      create: async (items) => {
        const created = items.map((item) => ({
          _id: (nextObjectId++).toString(16).padStart(24, '0'), esPrincipal: false,
          estadoAlmacenamiento: 'ACTIVA', ...item
        }));
        data.images.push(...created);
        return created;
      },
      updateOne: async (filter, update) => {
        if (updateFailures > 0) { updateFailures--; throw new Error('simulated database failure'); }
        const doc = data.images.find((image) => matches(image, filter));
        if (!doc) return { matchedCount: 0 };
        checkPrincipal(doc, update);
        applyUpdate(doc, update);
        return { matchedCount: 1 };
      },
      updateMany: async (filter, update) => {
        const docs = data.images.filter((image) => matches(image, filter));
        docs.forEach((doc) => applyUpdate(doc, update));
        return { modifiedCount: docs.length };
      },
      findOneAndUpdate: async (filter, update) => {
        const doc = data.images.find((image) => matches(image, filter));
        if (!doc) return null;
        checkPrincipal(doc, update);
        applyUpdate(doc, update);
        return doc;
      },
      bulkWrite: async (operations) => {
        for (const operation of operations) {
          const { filter, update } = operation.updateOne;
          const doc = data.images.find((image) => matches(image, filter));
          if (doc) applyUpdate(doc, update);
        }
        return { acknowledged: true };
      },
      deleteOne: async (filter) => {
        const index = data.images.findIndex((image) => matches(image, filter));
        if (index < 0) return { deletedCount: 0 };
        data.images.splice(index, 1);
        return { deletedCount: 1 };
      }
    }
  };
  const files = new Map();
  const storage = {
    isConfigured: () => true,
    upload: async (file, { publicId }) => {
      files.set(publicId, file.buffer);
      return { url: `https://res.cloudinary.com/test/image/upload/${publicId}.jpg`, publicId, bytes: file.buffer.length };
    },
    remove: async (publicId) => { files.delete(publicId); return true; }
  };
  return {
    data, files, models, storage,
    service: createAdminImageService(models, {
      storage, startSession: async () => session,
      idFactory: (() => { let id = 0; return () => `generated-${++id}`; })()
    })
  };
}

const jpeg = (overrides = {}) => ({
  originalname: '../unsafe-name.jpg', mimetype: 'image/jpeg',
  buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00]), size: 4, ...overrides
});
const png = () => ({ originalname: 'image.png', mimetype: 'image/png', buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), size: 8 });
const webp = () => ({ originalname: 'image.webp', mimetype: 'image/webp', buffer: Buffer.from('RIFF0000WEBP') });

test('consulta galería ordenada sin exponer IDs de Cloudinary', async () => {
  const setup = makeSetup({ images: [
    { _id: IMAGE_B, productoId: PRODUCT, url: 'https://res.cloudinary.com/x/b.jpg', publicId: 'private-b', posicion: 1 },
    { _id: IMAGE_A, productoId: PRODUCT, url: 'https://res.cloudinary.com/x/a.jpg', publicId: 'private-a', posicion: 0, esPrincipal: true }
  ] });
  const result = await setup.service.listImages(PRODUCT);
  assert.deepEqual(result.map((image) => image.id), [IMAGE_A, IMAGE_B]);
  assert.equal(result[0].esPrincipal, true);
  assert.equal(Object.hasOwn(result[0], 'publicId'), false);
});

test('producto inexistente devuelve 404', async () => {
  const setup = makeSetup({ product: null });
  await assert.rejects(setup.service.listImages(PRODUCT), (error) => error.statusCode === 404);
});

test('sube una imagen segura, guarda metadatos y marca la primera como principal', async () => {
  const setup = makeSetup();
  const result = await setup.service.uploadImages(PRODUCT, [jpeg()], { textosAlternativos: ['Gorra negra'] });
  assert.equal(result.length, 1);
  assert.equal(result[0].esPrincipal, true);
  assert.equal(result[0].textoAlternativo, 'Gorra negra');
  assert.equal(setup.data.images[0].publicId, `olla-vegana/products/${PRODUCT}/generated-1`);
  assert.equal(setup.data.images[0].url.startsWith('https://res.cloudinary.com/'), true);
  assert.equal(setup.data.images[0].tipoContenido, 'image/jpeg');
  assert.equal(setup.files.size, 1);
});

test('sube varias imágenes y valida asociaciones a variantes del producto', async () => {
  const setup = makeSetup();
  const result = await setup.service.uploadImages(PRODUCT, [jpeg(), png(), webp()], {
    textosAlternativos: ['Negra', 'Beige', 'Detalle'],
    varianteIds: [VARIANT, null, VARIANT]
  });
  assert.equal(result.length, 3);
  assert.equal(result.filter((image) => image.esPrincipal).length, 1);
  assert.equal(result[0].varianteId, VARIANT);
  assert.equal(result[1].varianteId, null);
  assert.equal(result[2].textoAlternativo, 'Detalle');
});

test('acepta JPG, PNG y WebP según firma real y tipo declarado', async () => {
  assert.equal(detectImageType(jpeg().buffer), 'image/jpeg');
  assert.equal(detectImageType(png().buffer), 'image/png');
  assert.equal(detectImageType(webp().buffer), 'image/webp');
  for (const file of [jpeg(), png(), webp()]) {
    const setup = makeSetup();
    assert.equal((await setup.service.uploadImages(PRODUCT, [file])).length, 1);
  }
});

test('rechaza bytes inválidos y MIME que no coincide con el contenido', async () => {
  const setup = makeSetup();
  await assert.rejects(setup.service.uploadImages(PRODUCT, [jpeg({ buffer: Buffer.from('not-image') })]), (error) => error.statusCode === 400);
  await assert.rejects(setup.service.uploadImages(PRODUCT, [jpeg({ mimetype: 'image/png' })]), (error) => error.statusCode === 400);
  assert.equal(setup.files.size, 0);
});

test('rechaza archivos que exceden el límite de bytes y el máximo de imágenes', async () => {
  const setup = makeSetup();
  const bounded = createAdminImageService(setup.models, { storage: setup.storage, maxSizeBytes: 3, startSession: async () => ({ withTransaction: async (fn) => fn(), endSession: async () => {} }) });
  await assert.rejects(bounded.uploadImages(PRODUCT, [jpeg()]), (error) => error.statusCode === 413);
  await assert.rejects(setup.service.uploadImages(PRODUCT, Array.from({ length: MAX_IMAGE_COUNT + 1 }, jpeg)), (error) => error.statusCode === 400);
});

test('la segunda carga no desplaza la imagen principal existente', async () => {
  const setup = makeSetup();
  const first = await setup.service.uploadImages(PRODUCT, [jpeg()]);
  const second = await setup.service.uploadImages(PRODUCT, [png()]);
  assert.equal(second.find((image) => image.id === first[0].id).esPrincipal, true);
  assert.equal(second.filter((image) => image.esPrincipal).length, 1);
});

test('errores de almacenamiento no exponen información del proveedor', async () => {
  const setup = makeSetup();
  setup.storage.upload = async () => { throw new Error('provider secret details'); };
  await assert.rejects(setup.service.uploadImages(PRODUCT, [jpeg()]), (error) => error.statusCode === 503 && !error.message.includes('provider'));
  assert.equal(setup.files.size, 0);
});

test('fallo de Mongo compensa las cargas y elimina marcadores si la compensación funciona', async () => {
  const setup = makeSetup({ failUpdate: 1 });
  await assert.rejects(setup.service.uploadImages(PRODUCT, [jpeg()]), /simulated database failure/);
  assert.equal(setup.files.size, 0);
  assert.equal(setup.data.images.length, 0);
});

test('fallo de compensación deja un marcador reintentable fuera del catálogo', async () => {
  const setup = makeSetup({ failUpdate: 1 });
  setup.storage.remove = async () => { throw new Error('external cleanup unavailable'); };
  await assert.rejects(setup.service.uploadImages(PRODUCT, [jpeg()]));
  assert.equal(setup.data.images.length, 1);
  assert.equal(setup.data.images[0].estadoAlmacenamiento, 'PENDIENTE_LIMPIEZA');
  assert.equal(setup.data.images[0].esPrincipal, false);
  assert.equal((await setup.service.listImages(PRODUCT))[0].limpiezaPendiente, true);
});

test('editar alt, orden, principal y variante válida; rechaza variante de otro producto', async () => {
  const setup = makeSetup({ images: [
    { _id: IMAGE_A, productoId: PRODUCT, url: 'https://res.cloudinary.com/x/a.jpg', publicId: 'a', posicion: 0, esPrincipal: true },
    { _id: IMAGE_B, productoId: PRODUCT, url: 'https://res.cloudinary.com/x/b.jpg', publicId: 'b', posicion: 1 }
  ] });
  const changed = await setup.service.editImage(PRODUCT, IMAGE_B, {
    textoAlternativo: 'Beige', posicion: 0, esPrincipal: true, varianteId: VARIANT
  });
  assert.equal(changed.textoAlternativo, 'Beige');
  assert.equal(changed.esPrincipal, true);
  assert.equal(changed.varianteId, VARIANT);
  assert.equal(setup.data.images.filter((image) => image.esPrincipal).length, 1);
  setup.models.Variante.findOne = () => queryResult(null);
  await assert.rejects(setup.service.editImage(PRODUCT, IMAGE_B, { varianteId: OTHER_VARIANT }), (error) => error.statusCode === 404);
  await assert.rejects(setup.service.editImage(PRODUCT, IMAGE_B, { publicId: 'client-supplied' }), (error) => error.statusCode === 400);
});

test('solicitudes simultáneas para cambiar la principal no dejan más de una', async () => {
  const setup = makeSetup({ images: [
    { _id: IMAGE_A, productoId: PRODUCT, url: 'https://res.cloudinary.com/x/a.jpg', publicId: 'a', posicion: 0 },
    { _id: IMAGE_B, productoId: PRODUCT, url: 'https://res.cloudinary.com/x/b.jpg', publicId: 'b', posicion: 1 }
  ] });
  const results = await Promise.allSettled([
    setup.service.editImage(PRODUCT, IMAGE_A, { esPrincipal: true }),
    setup.service.editImage(PRODUCT, IMAGE_B, { esPrincipal: true })
  ]);
  assert.ok(results.some((result) => result.status === 'fulfilled'));
  assert.equal(setup.data.images.filter((image) => image.esPrincipal).length, 1);
});

test('rechaza una imagen de otro producto e IDs inválidos', async () => {
  const setup = makeSetup({ images: [{ _id: IMAGE_A, productoId: OTHER_PRODUCT, url: 'https://res.cloudinary.com/x/a.jpg' }] });
  await assert.rejects(setup.service.editImage(PRODUCT, IMAGE_A, { textoAlternativo: 'x' }), (error) => error.statusCode === 404);
  await assert.rejects(setup.service.deleteImage(PRODUCT, 'bad'), (error) => error.statusCode === 400);
});

test('reordena toda la galería a posiciones contiguas y rechaza omisiones o duplicados', async () => {
  const setup = makeSetup({ images: [
    { _id: IMAGE_A, productoId: PRODUCT, url: 'https://res.cloudinary.com/x/a.jpg', publicId: 'a', posicion: 0 },
    { _id: IMAGE_B, productoId: PRODUCT, url: 'https://res.cloudinary.com/x/b.jpg', publicId: 'b', posicion: 1 },
    { _id: IMAGE_C, productoId: PRODUCT, url: 'https://res.cloudinary.com/x/c.jpg', publicId: 'c', posicion: 2 }
  ] });
  const reordered = await setup.service.reorderImages(PRODUCT, [IMAGE_C, IMAGE_A, IMAGE_B]);
  assert.deepEqual(reordered.map((image) => [image.id, image.posicion]), [[IMAGE_C, 0], [IMAGE_A, 1], [IMAGE_B, 2]]);
  await assert.rejects(setup.service.reorderImages(PRODUCT, [IMAGE_A, IMAGE_A, IMAGE_C]), (error) => error.statusCode === 400);
  await assert.rejects(setup.service.reorderImages(PRODUCT, [IMAGE_A]), (error) => error.statusCode === 400);
});

test('reemplaza archivo conservando el ID de imagen y elimina el anterior después del commit', async () => {
  const setup = makeSetup({ images: [{
    _id: IMAGE_A, productoId: PRODUCT, url: 'https://res.cloudinary.com/x/old.jpg',
    publicId: 'old', posicion: 0, esPrincipal: true
  }] });
  setup.files.set('old', Buffer.from('old'));
  const changed = await setup.service.replaceImage(PRODUCT, IMAGE_A, png());
  assert.equal(changed.id, IMAGE_A);
  assert.match(changed.url, /generated-1/);
  assert.equal(setup.files.has('old'), false);
  assert.equal(setup.files.size, 1);
});

test('si la carga de reemplazo falla, la imagen original queda intacta', async () => {
  const setup = makeSetup({ images: [{ _id: IMAGE_A, productoId: PRODUCT, url: 'https://res.cloudinary.com/x/old.jpg', publicId: 'old', posicion: 0 }] });
  setup.files.set('old', Buffer.from('old'));
  setup.storage.upload = async () => { throw new Error('provider failed'); };
  await assert.rejects(setup.service.replaceImage(PRODUCT, IMAGE_A, jpeg()), (error) => error.statusCode === 503);
  assert.equal(setup.data.images[0].url, 'https://res.cloudinary.com/x/old.jpg');
  assert.equal(setup.data.images[0].publicId, 'old');
  assert.equal(setup.files.has('old'), true);
});

test('si falla Mongo al registrar el reemplazo, compensa el nuevo archivo y conserva el original', async () => {
  const setup = makeSetup({ images: [{ _id: IMAGE_A, productoId: PRODUCT, url: 'https://res.cloudinary.com/x/old.jpg', publicId: 'old', posicion: 0 }] });
  setup.files.set('old', Buffer.from('old'));
  setup.models.ImagenProducto.findOneAndUpdate = async () => { throw new Error('simulated database failure'); };
  await assert.rejects(setup.service.replaceImage(PRODUCT, IMAGE_A, jpeg()), /simulated database failure/);
  assert.equal(setup.data.images.find((image) => image._id === IMAGE_A).publicId, 'old');
  assert.equal(setup.files.size, 1);
  assert.equal(setup.data.images.length, 1);
});

test('si falla la eliminación del recurso anterior al reemplazar, conserva el ID para reintento', async () => {
  const setup = makeSetup({ images: [{ _id: IMAGE_A, productoId: PRODUCT, url: 'https://res.cloudinary.com/x/old.jpg', publicId: 'old', posicion: 0 }] });
  setup.storage.remove = async () => { throw new Error('provider failed'); };
  const result = await setup.service.replaceImage(PRODUCT, IMAGE_A, jpeg());
  assert.equal(result.limpiezaPendiente, true);
  assert.equal(setup.data.images[0].publicIdPendienteEliminar, 'old');
});

test('preserva la URL heredada sin ID externo y exige revisión manual antes de reemplazar o borrar', async () => {
  const setup = makeSetup({ images: [{
    _id: IMAGE_A, productoId: PRODUCT, url: 'https://legacy.example.test/image.jpg', posicion: 0
  }] });
  const changed = await setup.service.replaceImage(PRODUCT, IMAGE_A, jpeg());
  assert.equal(changed.limpiezaPendiente, true);
  assert.equal(setup.data.images[0].urlPendienteRevision, 'https://legacy.example.test/image.jpg');
  await assert.rejects(setup.service.replaceImage(PRODUCT, IMAGE_A, png()), (error) => error.statusCode === 409);
  await assert.rejects(setup.service.deleteImage(PRODUCT, IMAGE_A), (error) => error.statusCode === 409);
});

test('elimina imagen asociada y promueve otra cuando se retira la principal', async () => {
  const setup = makeSetup({ images: [
    { _id: IMAGE_A, productoId: PRODUCT, url: 'https://res.cloudinary.com/x/a.jpg', publicId: 'a', posicion: 0, esPrincipal: true },
    { _id: IMAGE_B, productoId: PRODUCT, url: 'https://res.cloudinary.com/x/b.jpg', publicId: 'b', posicion: 1 }
  ] });
  setup.files.set('a', Buffer.from('a'));
  setup.files.set('b', Buffer.from('b'));
  assert.deepEqual(await setup.service.deleteImage(PRODUCT, IMAGE_A), { id: IMAGE_A, eliminada: true });
  assert.equal(setup.data.images.length, 1);
  assert.equal(setup.data.images[0].esPrincipal, true, JSON.stringify(setup.data.images));
  assert.equal(setup.files.has('a'), false);
});

test('error al eliminar deja la imagen oculta y permite reintentar por DELETE', async () => {
  const setup = makeSetup({ images: [{ _id: IMAGE_A, productoId: PRODUCT, url: 'https://res.cloudinary.com/x/a.jpg', publicId: 'a', posicion: 0 }] });
  setup.storage.remove = async () => { throw new Error('provider unavailable'); };
  await assert.rejects(setup.service.deleteImage(PRODUCT, IMAGE_A), (error) => error.statusCode === 503);
  assert.equal(setup.data.images[0].estadoAlmacenamiento, 'PENDIENTE_LIMPIEZA');
  setup.storage.remove = async () => true;
  assert.equal((await setup.service.deleteImage(PRODUCT, IMAGE_A)).eliminada, true);
});

test('Cloudinary ausente se reporta sin intentar una solicitud de red', async () => {
  let called = false;
  const storage = createCloudinaryStorage({}, { fetchImpl: async () => { called = true; } });
  assert.equal(storage.isConfigured(), false);
  await assert.rejects(storage.upload(jpeg(), { publicId: 'internal/id' }), (error) => error.statusCode === 503);
  assert.equal(called, false);
});

test('adaptador Cloudinary firma y envía archivo sin transmitir el secreto', async () => {
  const requests = [];
  const storage = createCloudinaryStorage({
    CLOUDINARY_CLOUD_NAME: 'test-cloud', CLOUDINARY_API_KEY: 'public-key', CLOUDINARY_API_SECRET: 'private-secret'
  }, { fetchImpl: async (url, options) => {
    requests.push({ url, form: options.body });
    return { ok: true, json: async () => requests.length === 1
      ? { secure_url: 'https://res.cloudinary.com/test-cloud/image/upload/id', public_id: 'id', bytes: 4 }
      : { result: 'not found' } };
  } });
  const result = await storage.upload(jpeg(), { publicId: 'id' });
  assert.equal(result.publicId, 'id');
  assert.equal(requests[0].form.get('file') instanceof Blob, true);
  assert.equal(requests[0].form.has('api_secret'), false);
  assert.equal(await storage.remove('id'), true);
  assert.equal(requests.length, 2);
});

test('el modelo declara índice único parcial de imagen principal sin autoIndex', () => {
  const index = ImagenProducto.schema.indexes().find(([keys, options]) => keys.productoId === 1 && keys.esPrincipal === 1 && options.unique);
  assert.ok(index);
  assert.deepEqual(index[1].partialFilterExpression, { esPrincipal: true });
  assert.equal(ImagenProducto.schema.options.autoIndex, false);
});

test('el middleware traduce límites multipart a respuestas 413 sin datos internos', () => {
  let response;
  const error = new Error('internal upload detail');
  error.name = 'MulterError';
  error.code = 'LIMIT_FILE_SIZE';
  const res = {
    status(code) { response = { status: code }; return this; },
    json(body) { response.body = body; return this; }
  };
  errorHandler(error, { method: 'POST', path: '/api/admin/products/x/images' }, res, () => {});
  assert.deepEqual(response, { status: 413, body: { error: 'La imagen supera el tamaño máximo permitido' } });
});

test('rutas de imágenes no están montadas públicamente y definen lectura, carga, edición y borrado', () => {
  const appSource = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf8');
  assert.doesNotMatch(appSource, /adminImageRoutes|\/api\/admin\/products/);
  const setup = makeSetup();
  const router = createAdminImageRoutes(setup.models, { storage: setup.storage, startSession: async () => ({ withTransaction: async (fn) => fn(), endSession: async () => {} }) });
  const routes = router.stack.filter((layer) => layer.route).map((layer) => ({
    path: layer.route.path,
    methods: Object.keys(layer.route.methods)
  }));
  assert.deepEqual(routes.map((route) => [route.path, route.methods[0]]), [
    ['/', 'get'], ['/', 'post'], ['/order', 'patch'], ['/:imageId/file', 'put'], ['/:imageId', 'patch'], ['/:imageId', 'delete']
  ]);
});
