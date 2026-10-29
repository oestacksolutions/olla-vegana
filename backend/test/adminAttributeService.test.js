const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const AppError = require('../src/utils/AppError');
const createAdminAttributeRoutes = require('../src/routes/adminAttributeRoutes');
const { createAdminAttributeService } = require('../src/services/adminAttributeService');

const ATTR_ID = '507f1f77bcf86cd799439011';
const VALUE_ID = '507f1f77bcf86cd799439012';
const VARIANT_ID = '507f1f77bcf86cd799439013';
const attribute = { _id: ATTR_ID, nombre: 'Color', createdAt: new Date('2025-01-01T00:00:00Z') };
const value = { _id: VALUE_ID, valor: 'Negro', atributoId: ATTR_ID };

function queryResult(data) {
  return { sort() { return this; }, lean() { return this; }, exec: async () => data };
}

function makeModels(overrides = {}) {
  return {
    Atributo: {
      find: () => queryResult([attribute]),
      findById: async () => attribute,
      findOne: async () => null,
      create: async (data) => ({ _id: ATTR_ID, ...data }),
      findByIdAndUpdate: async (id, data) => ({ ...attribute, _id: id, ...data }),
      ...overrides.Atributo
    },
    ValorAtributo: {
      find: () => queryResult([value]),
      findById: async () => value,
      findOne: async () => null,
      create: async (data) => ({ _id: VALUE_ID, ...data }),
      findByIdAndUpdate: async (id, data) => ({ ...value, _id: id, ...data }),
      ...overrides.ValorAtributo
    },
    ValorVariante: { find: () => queryResult([{ varianteId: VARIANT_ID, valorAtributoId: VALUE_ID }]), ...overrides.ValorVariante },
    ItemPedido: { countDocuments: async () => 0, ...overrides.ItemPedido },
    ReservaStock: { countDocuments: async () => 0, ...overrides.ReservaStock },
    MovimientoStock: { countDocuments: async () => 0, ...overrides.MovimientoStock }
  };
}

test('lista atributos y sus valores asociados', async () => {
  const service = createAdminAttributeService(makeModels());
  const result = await service.listAttributes();
  assert.equal(result.length, 1);
  assert.equal(result[0].nombre, 'Color');
  assert.deepEqual(result[0].valores, [{ id: VALUE_ID, valor: 'Negro' }]);
});

test('crea atributo y rechaza nombre vacío, propiedades extra y duplicados', async () => {
  let created;
  const service = createAdminAttributeService(makeModels({ Atributo: {
    findOne: async () => null,
    create: async (data) => { created = data; return { _id: ATTR_ID, ...data }; }
  } }));
  const result = await service.createAttribute({ nombre: '  Material  ' });
  assert.deepEqual(created, { nombre: 'Material' });
  assert.equal(result.nombre, 'Material');
  await assert.rejects(service.createAttribute({ nombre: ' ' }), (error) => error.statusCode === 400);
  await assert.rejects(service.createAttribute({ nombre: 'Talle', activo: true }), (error) => error.statusCode === 400);
  const duplicate = createAdminAttributeService(makeModels({ Atributo: { findOne: async () => attribute } }));
  await assert.rejects(duplicate.createAttribute({ nombre: 'Color' }), (error) => error.statusCode === 409);
});

test('edita el nombre del atributo si no altera pedidos ni reservas y preserva sus valores', async () => {
  let update;
  const service = createAdminAttributeService(makeModels({ Atributo: {
    findByIdAndUpdate: async (id, data) => { update = data; return { ...attribute, ...data }; }
  } }));
  const result = await service.updateAttribute(ATTR_ID, { nombre: 'Tono' });
  assert.deepEqual(update, { nombre: 'Tono' });
  assert.equal(result.nombre, 'Tono');
  const duplicate = createAdminAttributeService(makeModels({ Atributo: {
    findOne: async (filter) => filter._id ? attribute : { _id: VARIANT_ID, nombre: 'Talle' }
  } }));
  await assert.rejects(duplicate.updateAttribute(ATTR_ID, { nombre: 'Talle' }), (error) => error.statusCode === 409);
  const historic = createAdminAttributeService(makeModels({ ItemPedido: { countDocuments: async () => 1 } }));
  await assert.rejects(historic.updateAttribute(ATTR_ID, { nombre: 'Nuevo nombre' }), (error) => error.statusCode === 409);
});

test('consulta y crea valores únicamente para un atributo existente', async () => {
  let created;
  const service = createAdminAttributeService(makeModels({ ValorAtributo: {
    find: () => queryResult([value]),
    findOne: async () => null,
    create: async (data) => { created = data; return { _id: VALUE_ID, ...data }; }
  } }));
  const values = await service.listValues(ATTR_ID);
  assert.equal(values[0].atributo, 'Color');
  const result = await service.createValue(ATTR_ID, { valor: 'Beige' });
  assert.deepEqual(created, { atributoId: ATTR_ID, valor: 'Beige' });
  assert.equal(result.atributoId, ATTR_ID);
  const noAttribute = createAdminAttributeService(makeModels({ Atributo: { findById: async () => null } }));
  await assert.rejects(noAttribute.createValue(ATTR_ID, { valor: 'Beige' }), (error) => error.statusCode === 404);
});

test('evita valores duplicados y valida ID y propiedades', async () => {
  const duplicate = createAdminAttributeService(makeModels({ ValorAtributo: { findOne: async () => value } }));
  await assert.rejects(duplicate.createValue(ATTR_ID, { valor: 'Negro' }), (error) => error.statusCode === 409);
  const service = createAdminAttributeService(makeModels());
  await assert.rejects(service.listValues('id-invalido'), (error) => error.statusCode === 400);
  await assert.rejects(service.createValue(ATTR_ID, { valor: 'Blanco', atributoId: 'otro' }), (error) => error.statusCode === 400);
});

test('edita el valor manteniendo su atributo y bloquea cambios con historial asociado', async () => {
  let update;
  const service = createAdminAttributeService(makeModels({ ValorAtributo: {
    findByIdAndUpdate: async (id, data) => { update = data; return { ...value, ...data }; }
  } }));
  const result = await service.updateValue(VALUE_ID, { valor: 'Negro clásico' });
  assert.deepEqual(update, { valor: 'Negro clásico' });
  assert.equal(result.atributoId, ATTR_ID);
  const duplicate = createAdminAttributeService(makeModels({ ValorAtributo: {
    findOne: async () => ({ _id: VARIANT_ID, atributoId: ATTR_ID, valor: 'Blanco' })
  } }));
  await assert.rejects(duplicate.updateValue(VALUE_ID, { valor: 'Blanco' }), (error) => error.statusCode === 409);
  const historic = createAdminAttributeService(makeModels({ ReservaStock: { countDocuments: async () => 1 } }));
  await assert.rejects(historic.updateValue(VALUE_ID, { valor: 'Nuevo' }), (error) => error.statusCode === 409);
  const withMovement = createAdminAttributeService(makeModels({ MovimientoStock: { countDocuments: async () => 1 } }));
  await assert.rejects(withMovement.updateValue(VALUE_ID, { valor: 'Otro' }), (error) => error.statusCode === 409);
});

test('las rutas de atributos no están montadas en app.js y no incluyen borrado', () => {
  const appSource = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf8');
  assert.doesNotMatch(appSource, /adminAttributeRoutes|\/api\/admin\/attributes/);
  const routes = createAdminAttributeRoutes(makeModels());
  const definitions = routes.stack.filter((layer) => layer.route).map((layer) => ({
    path: layer.route.path, method: Object.keys(layer.route.methods)[0]
  }));
  assert.ok(definitions.some((route) => route.path === '/attributes' && route.method === 'get'));
  assert.ok(definitions.some((route) => route.path === '/attributes/:id/values' && route.method === 'post'));
  assert.ok(definitions.some((route) => route.path === '/attribute-values/:id' && route.method === 'patch'));
  assert.equal(definitions.some((route) => route.method === 'delete'), false);
});
