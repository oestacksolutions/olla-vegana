const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const createAdminVariantRoutes = require('../src/routes/adminVariantRoutes');
const { createAdminVariantService } = require('../src/services/adminVariantService');
const { canonicalCombinationKey } = require('../src/utils/variantCombination');
const VarianteModel = require('../src/models/Variante');

const PRODUCT_ID = '507f1f77bcf86cd799439011';
const VARIANT_A = '507f1f77bcf86cd799439012';
const VARIANT_B = '507f1f77bcf86cd799439013';
const ATTR_COLOR = '507f1f77bcf86cd799439014';
const ATTR_SIZE = '507f1f77bcf86cd799439015';
const VALUE_BLACK = '507f1f77bcf86cd799439016';
const VALUE_BEIGE = '507f1f77bcf86cd799439017';
const VALUE_SMALL = '507f1f77bcf86cd799439018';

function queryResult(data) {
  return {
    sort() { return this; },
    session() { return this; },
    lean() { return this; },
    exec: async () => data
  };
}

function makeModels({ variants = [], links = [], history = {}, product = { _id: PRODUCT_ID }, withSession, beforeDuplicateRead, combinationIndex = true } = {}) {
  const data = { variants: variants.map((item) => ({ stock: 0, activa: true, ...item })), links: [...links] };
  const session = {
    withTransaction: async (operation) => operation(),
    endSession: async () => {}
  };
  const models = {
    Producto: { findById: () => queryResult(product) },
    Variante: {
      collection: { indexes: async () => combinationIndex ? [{
        name: 'uniq_variante_producto_combinacion_activa', unique: true,
        key: { productoId: 1, combinacionClave: 1 },
        partialFilterExpression: { activa: true, combinacionClave: { $type: 'string' } }
      }] : [] },
      find: (filter = {}) => {
        const rows = data.variants.filter((item) =>
          (!filter.productoId || String(item.productoId) === String(filter.productoId)) &&
          (!filter._id || String(item._id) === String(filter._id))
        );
        const query = queryResult(rows);
        if (beforeDuplicateRead && filter.productoId && !filter._id) {
          query.exec = async () => { await beforeDuplicateRead(); return rows; };
        }
        return query;
      },
      findOne: ({ _id, productoId }) => queryResult(data.variants.find((item) =>
        String(item._id) === String(_id) && (!productoId || String(item.productoId) === String(productoId))
      ) || null),
      create: async ([input]) => {
        if (input.activa && data.variants.some((item) => item.activa !== false &&
          String(item.productoId) === String(input.productoId) && item.combinacionClave === input.combinacionClave)) {
          const error = new Error('duplicate key'); error.code = 11000; throw error;
        }
        const item = { _id: VARIANT_B, stock: 0, activa: true, ...input };
        data.variants.push(item);
        return [item];
      },
      findByIdAndUpdate: async (id, update) => {
        const item = data.variants.find((entry) => String(entry._id) === String(id));
        if (!item) return null;
        if (update.activa !== false && data.variants.some((other) => other !== item && other.activa !== false &&
          String(other.productoId) === String(item.productoId) && other.combinacionClave === update.combinacionClave)) {
          const error = new Error('duplicate key'); error.code = 11000; throw error;
        }
        Object.assign(item, update);
        return item;
      }
    },
    Atributo: { find: (filter) => queryResult([
      { _id: ATTR_COLOR, nombre: 'Color' }, { _id: ATTR_SIZE, nombre: 'Talle' }
    ].filter((item) => filter._id.$in.some((id) => String(id) === String(item._id)))) },
    ValorAtributo: { find: (filter) => queryResult([
      { _id: VALUE_BLACK, atributoId: ATTR_COLOR, valor: 'Negro' },
      { _id: VALUE_BEIGE, atributoId: ATTR_COLOR, valor: 'Beige' },
      { _id: VALUE_SMALL, atributoId: ATTR_SIZE, valor: 'S' }
    ].filter((item) => filter._id.$in.some((id) => String(id) === String(item._id)))) },
    ValorVariante: {
      find: (filter) => {
        const ids = filter.varianteId.$in || [filter.varianteId];
        return queryResult(data.links.filter((link) => ids.some((id) => String(id) === String(link.varianteId))));
      },
      create: async (items) => { data.links.push(...items); return items; },
      deleteMany: async (filter) => {
        data.links = data.links.filter((link) => String(link.varianteId) !== String(filter.varianteId));
        return { acknowledged: true };
      }
    },
    ItemPedido: { countDocuments: async () => history.items || 0 },
    ReservaStock: { countDocuments: async () => history.reservations || 0 },
    MovimientoStock: { countDocuments: async () => history.movements || 0 }
  };
  return { models, data, startSession: withSession || (async () => session) };
}

const pair = (atributoId, valorAtributoId) => ({ atributoId, valorAtributoId });

test('crea variante de un atributo, stock inicial del modelo solo se devuelve y nunca se envía', async () => {
  const { models, data, startSession } = makeModels();
  const service = createAdminVariantService(models, { startSession });
  const result = await service.createVariant(PRODUCT_ID, { valores: [pair(ATTR_COLOR, VALUE_BLACK)] });
  assert.equal(result.stock, 0);
  assert.equal(result.valores[0].atributo, 'Color');
  assert.equal(data.variants.length, 1);
  assert.deepEqual(data.links.map((link) => link.valorAtributoId), [VALUE_BLACK]);
  await assert.rejects(service.createVariant(PRODUCT_ID, {
    valores: [pair(ATTR_COLOR, VALUE_BEIGE)], stock: 100
  }), (error) => error.statusCode === 400);
});

test('crea una variante sin atributos cuando el índice único está verificado', async () => {
  const { models, data, startSession } = makeModels();
  const result = await createAdminVariantService(models, { startSession }).createVariant(PRODUCT_ID, { valores: [] });
  assert.equal(result.valores.length, 0);
  assert.equal(data.variants[0].combinacionClave, 'v1:none');
});

test('bloquea escrituras si el índice único físico de combinaciones no está provisionado', async () => {
  const { models, data, startSession } = makeModels({ combinationIndex: false });
  await assert.rejects(createAdminVariantService(models, { startSession }).createVariant(PRODUCT_ID, { valores: [pair(ATTR_COLOR, VALUE_BLACK)] }), (error) => error.statusCode === 503);
  assert.equal(data.variants.length, 0);
});

test('crea variantes con combinaciones de varios atributos sin limitar los nombres', async () => {
  const { models, startSession } = makeModels();
  const service = createAdminVariantService(models, { startSession });
  const result = await service.createVariant(PRODUCT_ID, {
    valores: [pair(ATTR_SIZE, VALUE_SMALL), pair(ATTR_COLOR, VALUE_BLACK)], precio: '1250.50'
  });
  assert.equal(result.precio, '1250.50');
  assert.deepEqual(result.valores.map((item) => item.atributo).sort(), ['Color', 'Talle']);
});

test('rechaza dos valores del mismo atributo y valida producto, atributos, valores y pertenencia', async () => {
  const { models, startSession } = makeModels();
  const service = createAdminVariantService(models, { startSession });
  await assert.rejects(service.createVariant(PRODUCT_ID, {
    valores: [pair(ATTR_COLOR, VALUE_BLACK), pair(ATTR_COLOR, VALUE_BEIGE)]
  }), (error) => error.statusCode === 400);
  await assert.rejects(service.createVariant(PRODUCT_ID, {
    valores: [pair(ATTR_COLOR, VALUE_SMALL)]
  }), (error) => error.statusCode === 400);
  await assert.rejects(service.createVariant(PRODUCT_ID, {
    valores: [pair('507f1f77bcf86cd799439099', VALUE_BLACK)]
  }), (error) => error.statusCode === 404);
  const missingProduct = makeModels({ product: null });
  await assert.rejects(createAdminVariantService(missingProduct.models, { startSession: missingProduct.startSession })
    .createVariant(PRODUCT_ID, { valores: [pair(ATTR_COLOR, VALUE_BLACK)] }), (error) => error.statusCode === 404);
});

test('detecta combinaciones duplicadas sin importar el orden de los valores', async () => {
  const { models, startSession } = makeModels({
    variants: [{ _id: VARIANT_A, productoId: PRODUCT_ID }],
    links: [
      { varianteId: VARIANT_A, valorAtributoId: VALUE_BLACK },
      { varianteId: VARIANT_A, valorAtributoId: VALUE_SMALL }
    ]
  });
  const service = createAdminVariantService(models, { startSession });
  await assert.rejects(service.createVariant(PRODUCT_ID, {
    valores: [pair(ATTR_SIZE, VALUE_SMALL), pair(ATTR_COLOR, VALUE_BLACK)]
  }), (error) => error.statusCode === 409);

  const updateSetup = makeModels({
    variants: [
      { _id: VARIANT_A, productoId: PRODUCT_ID },
      { _id: VARIANT_B, productoId: PRODUCT_ID }
    ],
    links: [
      { varianteId: VARIANT_A, valorAtributoId: VALUE_BLACK },
      { varianteId: VARIANT_B, valorAtributoId: VALUE_BEIGE }
    ]
  });
  await assert.rejects(createAdminVariantService(updateSetup.models, { startSession: updateSetup.startSession })
    .updateVariant(PRODUCT_ID, VARIANT_A, { valores: [pair(ATTR_COLOR, VALUE_BEIGE)] }),
  (error) => error.statusCode === 409);
});

test('permite reemplazar con una nueva variante activa a una variante histórica desactivada', async () => {
  const { models, data, startSession } = makeModels({
    variants: [{ _id: VARIANT_A, productoId: PRODUCT_ID, activa: false, stock: 3 }],
    links: [{ varianteId: VARIANT_A, valorAtributoId: VALUE_BLACK }],
    history: { items: 1 }
  });
  const service = createAdminVariantService(models, { startSession });
  const replacement = await service.createVariant(PRODUCT_ID, { valores: [pair(ATTR_COLOR, VALUE_BLACK)] });
  assert.equal(replacement.activa, true);
  assert.equal(data.variants.length, 2);
  assert.equal(data.variants[0].activa, false);
});

test('lista variantes activas e inactivas con atributos y stock de solo lectura', async () => {
  const { models, startSession } = makeModels({
    variants: [{ _id: VARIANT_A, productoId: PRODUCT_ID, stock: 5, activa: false }],
    links: [{ varianteId: VARIANT_A, valorAtributoId: VALUE_BLACK }]
  });
  const result = await createAdminVariantService(models, { startSession }).listVariants(PRODUCT_ID);
  assert.equal(result.variantes.length, 1);
  assert.equal(result.variantes[0].stock, 5);
  assert.equal(result.variantes[0].activa, false);
  assert.equal(result.variantes[0].valores[0].valor, 'Negro');
});

test('edita precio, estado y combinaciones cuando no hay historial; no acepta stock', async () => {
  const { models, data, startSession } = makeModels({
    variants: [{ _id: VARIANT_A, productoId: PRODUCT_ID, stock: 9 }],
    links: [{ varianteId: VARIANT_A, valorAtributoId: VALUE_BLACK }]
  });
  const service = createAdminVariantService(models, { startSession });
  const result = await service.updateVariant(PRODUCT_ID, VARIANT_A, {
    valores: [pair(ATTR_COLOR, VALUE_BEIGE)], precio: '90.00', activa: false
  });
  assert.equal(result.stock, 9);
  assert.equal(result.precio, '90.00');
  assert.equal(result.activa, false);
  assert.deepEqual(data.links.map((link) => link.valorAtributoId), [VALUE_BEIGE]);
  assert.equal(data.variants[0].combinacionClave,
    canonicalCombinationKey([pair(ATTR_COLOR, VALUE_BEIGE)]));
  const reactivated = await service.updateVariant(PRODUCT_ID, VARIANT_A, { activa: true });
  assert.equal(reactivated.activa, true);
  assert.equal(reactivated.stock, 9);
  await assert.rejects(service.updateVariant(PRODUCT_ID, VARIANT_A, { stock: 2 }), (error) => error.statusCode === 400);
  await assert.rejects(service.updateVariant(PRODUCT_ID, VARIANT_A, { precio: '-1' }), (error) => error.statusCode === 400);
});

test('bloquea cambiar la identidad comercial con pedidos, reservas o movimientos históricos', async () => {
  for (const history of [{ items: 1 }, { reservations: 1 }, { movements: 1 }]) {
    const { models, startSession } = makeModels({
      variants: [{ _id: VARIANT_A, productoId: PRODUCT_ID, stock: 2 }],
      links: [{ varianteId: VARIANT_A, valorAtributoId: VALUE_BLACK }],
      history
    });
    const service = createAdminVariantService(models, { startSession });
    await assert.rejects(service.updateVariant(PRODUCT_ID, VARIANT_A, {
      valores: [pair(ATTR_COLOR, VALUE_BEIGE)]
    }), (error) => error.statusCode === 409);
  }
});

test('rechaza IDs inválidos y variantes que no pertenecen al producto de la ruta', async () => {
  const { models, startSession } = makeModels();
  const service = createAdminVariantService(models, { startSession });
  await assert.rejects(service.listVariants('bad-id'), (error) => error.statusCode === 400);
  await assert.rejects(service.updateVariant(PRODUCT_ID, 'bad-id', { activa: false }), (error) => error.statusCode === 400);
  await assert.rejects(service.updateVariant(PRODUCT_ID, VARIANT_B, { activa: false }), (error) => error.statusCode === 404);
});

test('rutas administrativas de variantes están montadas con autenticación y no exponen escritura pública', () => {
  const appSource = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf8');

  assert.match(appSource, /app\.use\(\s*'\/api\/admin\/products\/:productId\/variants',\s*authenticate,\s*authorizeAdmin,\s*validateJsonBody,\s*createAdminVariantRoutes/s);

  const { models, startSession } = makeModels();
  const routes = createAdminVariantRoutes(models);

  const definitions = routes.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      path: layer.route.path,
      method: Object.keys(layer.route.methods)[0]
    }));

  assert.deepEqual(definitions, [
    { path: '/', method: 'get' },
    { path: '/', method: 'post' },
    { path: '/:variantId', method: 'patch' }
  ]);

  assert.equal(typeof startSession, 'function');
});

test('la clave canónica no depende del orden e identifica variantes sin atributos', () => {
  const pairs = [pair(ATTR_SIZE, VALUE_SMALL), pair(ATTR_COLOR, VALUE_BLACK)];
  assert.equal(canonicalCombinationKey(pairs), canonicalCombinationKey([...pairs].reverse()));
  assert.equal(canonicalCombinationKey([]), 'v1:none');
  assert.notEqual(canonicalCombinationKey([]), canonicalCombinationKey([pair(ATTR_COLOR, VALUE_BLACK)]));
});

test('el modelo declara unicidad parcial para variantes activas con clave', () => {
  const index = VarianteModel.schema.indexes().find(([keys, options]) =>
    keys.productoId === 1 && keys.combinacionClave === 1 && options.unique
  );
  assert.ok(index);
  assert.deepEqual(index[1].partialFilterExpression, {
    activa: true, combinacionClave: { $type: 'string' }
  });
  assert.equal(VarianteModel.schema.options.autoIndex, false);
});

test('dos creaciones simultáneas con la misma combinación terminan en éxito y conflicto', async () => {
  let readers = 0;
  let release;
  const barrier = new Promise((resolve) => { release = resolve; });
  const setup = makeModels({ beforeDuplicateRead: async () => {
    readers += 1;
    if (readers === 2) release();
    await barrier;
  } });
  const service = createAdminVariantService(setup.models, { startSession: setup.startSession });
  const results = await Promise.allSettled([
    service.createVariant(PRODUCT_ID, { valores: [pair(ATTR_COLOR, VALUE_BLACK)] }),
    service.createVariant(PRODUCT_ID, { valores: [pair(ATTR_COLOR, VALUE_BLACK)] })
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(results.find((result) => result.status === 'rejected').reason.statusCode, 409);
  assert.equal(setup.data.variants.filter((variant) => variant.activa !== false).length, 1);
});

test('reactivar variante histórica rechaza una combinación activa y conserva la variante inactiva', async () => {
  const key = canonicalCombinationKey([pair(ATTR_COLOR, VALUE_BLACK)]);
  const setup = makeModels({
    variants: [
      { _id: VARIANT_A, productoId: PRODUCT_ID, activa: true, combinacionClave: key },
      { _id: VARIANT_B, productoId: PRODUCT_ID, activa: false }
    ],
    links: [
      { varianteId: VARIANT_A, valorAtributoId: VALUE_BLACK },
      { varianteId: VARIANT_B, valorAtributoId: VALUE_BLACK }
    ]
  });
  const service = createAdminVariantService(setup.models, { startSession: setup.startSession });
  await assert.rejects(service.updateVariant(PRODUCT_ID, VARIANT_B, { activa: true }), (error) => error.statusCode === 409);
  assert.equal(setup.data.variants.find((variant) => variant._id === VARIANT_B).activa, false);
});

test('documentos heredados sin clave se consultan y reciben clave al editarse', async () => {
  const setup = makeModels({
    variants: [{ _id: VARIANT_A, productoId: PRODUCT_ID, stock: 4 }],
    links: [{ varianteId: VARIANT_A, valorAtributoId: VALUE_BLACK }]
  });
  const service = createAdminVariantService(setup.models, { startSession: setup.startSession });
  assert.equal((await service.listVariants(PRODUCT_ID)).variantes[0].stock, 4);
  await service.updateVariant(PRODUCT_ID, VARIANT_A, { precio: '10' });
  assert.equal(setup.data.variants[0].combinacionClave,
    canonicalCombinationKey([pair(ATTR_COLOR, VALUE_BLACK)]));
});

test('variantes heredadas sin atributos usan una clave común y no se pueden reactivar duplicadas', async () => {
  const setup = makeModels({
    variants: [
      { _id: VARIANT_A, productoId: PRODUCT_ID, activa: true },
      { _id: VARIANT_B, productoId: PRODUCT_ID, activa: false }
    ]
  });
  const service = createAdminVariantService(setup.models, { startSession: setup.startSession });
  assert.equal((await service.listVariants(PRODUCT_ID)).variantes.length, 2);
  await assert.rejects(service.updateVariant(PRODUCT_ID, VARIANT_B, { activa: true }), (error) => error.statusCode === 409);
  assert.equal(setup.data.variants[0].combinacionClave, undefined);
  assert.equal(setup.data.variants[1].activa, false);
});
