const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createSeedRunner, databaseHasData, SEED_MARKER_ID } = require('../src/seeders/seed');

const clone = (value) => structuredClone(value);
function matches(doc, filter) {
  return Object.entries(filter).every(([key, expected]) => {
    const actual = doc[key];
    if (expected && typeof expected === 'object' && '$exists' in expected) return (actual !== undefined) === expected.$exists;
    if (expected && typeof expected === 'object' && '$in' in expected) return expected.$in.some((v) => String(v) === String(actual));
    if (expected && typeof expected === 'object' && '$ne' in expected) return String(actual) !== String(expected.$ne);
    return String(actual) === String(expected);
  });
}

function harness({ existing = {}, failProductInsert = false, dataBarrier } = {}) {
  const state = { collections: clone(existing), markers: [] };
  const counters = { businessWrites: 0, connect: 0, disconnect: 0, transactions: 0 };
  let activeSession = null;
  function modelsFor() {
    const makeModel = (name) => ({
      findOneAndUpdate: async (filter, update, options = {}) => {
        const source = options.session?.working || activeSession?.working || state;
        if (name === 'Producto' && failProductInsert && options.session) {
          failProductInsert = false;
          throw new Error('simulated failure');
        }
        const docs = name === 'SeedInitialization' ? source.markers : (source.collections[name] ||= []);
        let doc = docs.find((item) => matches(item, filter));
        if (!doc) {
          const id = filter._id;
          if (id !== undefined && docs.some((item) => String(item._id) === String(id))) {
            const error = new Error('duplicate'); error.code = 11000; throw error;
          }
          if (!options.upsert) return null;
          doc = { ...Object.fromEntries(Object.entries(filter).filter(([, value]) => !value || typeof value !== 'object')), ...(update.$setOnInsert || {}), ...(update.$set || {}) };
          doc._id ??= `${name}-${docs.length + 1}`;
          docs.push(doc);
          if (name !== 'SeedInitialization') counters.businessWrites += 1;
        }
        return doc;
      },
      findOne: async (filter) => {
        const source = activeSession?.working || state;
        return (name === 'SeedInitialization' ? source.markers : (source.collections[name] || [])).find((item) => matches(item, filter)) || null;
      },
      findById: async (id) => {
        const source = activeSession?.working || state;
        return source.markers.find((item) => String(item._id) === String(id)) || null;
      },
      find: async (filter) => {
        const source = activeSession?.working || state;
        return (source.collections[name] || []).filter((item) => matches(item, filter));
      },
      updateOne: async (filter, update, options = {}) => {
        const source = options.session?.working || activeSession?.working || state;
        const docs = name === 'SeedInitialization' ? source.markers : (source.collections[name] || []);
        const doc = docs.find((item) => matches(item, filter));
        if (doc) Object.assign(doc, update.$set || {});
        return { matchedCount: doc ? 1 : 0 };
      }
    });
    return Object.fromEntries(['Categoria', 'Atributo', 'ValorAtributo', 'Producto', 'Variante', 'ValorVariante', 'Configuracion', 'PuntoRetiro'].map((name) => [name, makeModel(name)]));
  }
  const markerModel = {
    collection: { name: 'seedinitializations' },
    findById: async (id) => state.markers.find((item) => String(item._id) === String(id)) || null,
    findOneAndUpdate: async (filter, update) => {
      const found = state.markers.find((item) => matches(item, filter));
      if (found) return found;
      if (state.markers.some((item) => String(item._id) === String(filter._id))) { const err = new Error('duplicate'); err.code = 11000; throw err; }
      const doc = { _id: filter._id, ...update.$set };
      state.markers.push(doc);
      return doc;
    },
    updateOne: async (filter, update, options = {}) => {
      const markers = options.session ? options.session.working.markers : state.markers;
      const doc = markers.find((item) => matches(item, filter));
      if (doc) Object.assign(doc, update.$set || {});
      return { matchedCount: doc ? 1 : 0 };
    }
  };
  const startSession = async () => ({
    working: null,
    async withTransaction(callback) {
      counters.transactions += 1;
      this.working = clone(state);
      activeSession = this;
      try {
        await callback();
        state.collections = this.working.collections;
        state.markers = this.working.markers;
      } finally {
        activeSession = null;
        this.working = null;
      }
    },
    async endSession() {}
  });
  const run = createSeedRunner({
    models: modelsFor(), markerModel,
    connect: async () => { counters.connect += 1; },
    disconnect: async () => { counters.disconnect += 1; },
    startSession,
    hasBusinessData: async (session) => {
      if (dataBarrier && !session) await dataBarrier();
      const collections = session ? session.working.collections : state.collections;
      return Object.values(collections).some((docs) => docs.length > 0);
    },
    logger: { log() {} }, tokenFactory: () => 'owner-test'
  });
  return { run, state, counters };
}

test('primera ejecución inicializa 3 categorías, 3 productos, 7 variantes y 50 unidades', async () => {
  const h = harness();
  const result = await h.run();
  assert.equal(result.estado, 'completado');
  assert.equal(h.state.collections.Categoria.length, 3);
  assert.equal(h.state.collections.Atributo.length, 5);
  assert.equal(h.state.collections.ValorAtributo.length, 8);
  assert.equal(h.state.collections.Producto.length, 3);
  assert.equal(h.state.collections.Variante.length, 7);
  assert.equal(h.state.collections.Variante.reduce((sum, variant) => sum + variant.stock, 0), 50);
  const prices = Object.fromEntries(h.state.collections.Producto.map((product) => [product.slug, product.precioBase]));
  assert.deepEqual(prices, {
    'remera-nadie-se-salva-solx': '45000.00',
    'gorra-olla-vegana': '27000.00',
    'tote-oficial-olla-vegana': '27000.00'
  });
  const stock = Object.fromEntries(h.state.collections.Variante.map((variant) => [variant.claveSeed.split(':')[1], variant.stock]));
  assert.deepEqual(stock, {
    'talle-s': 0, 'talle-m': 0, 'talle-l': 10,
    'color-negro': 10, 'color-beige': 10,
    'estampado-logo': 10, 'estampado-flores': 10
  });
  const measuresAttribute = h.state.collections.Atributo.find((attribute) => attribute.nombre === 'Medidas');
  const measuresValue = h.state.collections.ValorAtributo.find((value) => value.atributoId === measuresAttribute._id);
  const largeVariant = h.state.collections.Variante.find((variant) => variant.claveSeed.endsWith('talle-l'));
  const measurementLinks = h.state.collections.ValorVariante.filter((link) => link.valorAtributoId === measuresValue._id);
  assert.deepEqual(measurementLinks.map((link) => link.varianteId), [largeVariant._id]);
  assert.equal(h.state.collections.PuntoRetiro.length, 3);
  const moron = h.state.collections.PuntoRetiro.find((point) => point.nombre === 'Morón');
  const moreno = h.state.collections.PuntoRetiro.find((point) => point.nombre === 'Moreno');
  const ramos = h.state.collections.PuntoRetiro.find((point) => point.nombre === 'Ramos Mejía');
  assert.deepEqual(moron.horariosHabituales.map(({ diaSemana, horaInicio, horaFin }) => [diaSemana, horaInicio, horaFin]), [
    ['MARTES', '16:00', '19:00'], ['VIERNES', '16:00', '19:00']
  ]);
  assert.deepEqual(moreno.horariosHabituales.map(({ diaSemana, horaInicio, horaFin }) => [diaSemana, horaInicio, horaFin]), [['VIERNES', '16:00', '19:00']]);
  assert.deepEqual(ramos.horariosHabituales, []);
  assert.equal(moron.direccion, null);
  assert.equal(moreno.direccion, null);
  assert.equal(ramos.direccion, null);
  assert.equal(ramos.activo, true);
  assert.equal(ramos.habilitadoCheckout, false);
  assert.equal(h.state.collections.RetiroEspecial, undefined);
  assert.equal(h.state.markers[0].estado, 'completado');
  assert.equal(h.counters.transactions, 1);
});

test('segunda ejecución no modifica documentos ni recrea productos eliminados', async () => {
  const h = harness();
  await h.run();
  const shirt = h.state.collections.Producto.find((item) => item.slug === 'remera-nadie-se-salva-solx');
  const large = h.state.collections.Variante.find((item) => item.claveSeed.endsWith('talle-l'));
  shirt.precioBase = '999.00'; shirt.activo = false; shirt.nombre = 'Editado desde panel';
  shirt.descripcion = 'Descripción manual'; shirt.categoriaId = 'categoria-personalizada'; large.stock = 2;
  h.state.collections.Categoria[0].nombre = 'Categoría editada';
  h.state.collections.Categoria[0].activa = false;
  h.state.collections.Configuracion[0].valor = '48';
  const moron = h.state.collections.PuntoRetiro.find((point) => point.nombre === 'Morón');
  moron.direccion = 'Dirección confirmada por administración';
  moron.habilitadoCheckout = true;
  moron.horariosHabituales = [{ diaSemana: 'LUNES', horaInicio: '10:00', horaFin: '12:00' }];
  h.state.collections.Banner = [{ _id: 'banner-panel', imagenUrl: 'ruta-real' }];
  h.state.collections.PuntoRetiro = [{ _id: 'retiro-panel', nombre: 'Punto real' }];
  h.state.collections.Admin = [{ _id: 'admin-panel', correo: 'administrador-real' }];
  const deletedId = h.state.collections.Producto.find((item) => item.slug === 'gorra-olla-vegana')._id;
  h.state.collections.Producto = h.state.collections.Producto.filter((item) => item._id !== deletedId);
  const snapshot = clone(h.state);
  const writes = h.counters.businessWrites;

  assert.equal((await h.run()).estado, 'omitido');
  assert.deepEqual(h.state, snapshot);
  assert.equal(h.counters.businessWrites, writes);
  assert.equal(h.state.collections.Producto.some((item) => item.slug === 'gorra-olla-vegana'), false);
});

test('base con documentos y sin marca se rechaza sin escribir', async () => {
  const h = harness({ existing: { Producto: [{ _id: 'manual', slug: 'producto-panel' }] } });
  const snapshot = clone(h.state);
  await assert.rejects(h.run(), /contiene datos y no tiene marca/);
  assert.deepEqual(h.state, snapshot);
  assert.equal(h.counters.businessWrites, 0);
});

test('fallo parcial revierte toda la carga y deja estado fallido, nunca completado', async () => {
  const h = harness({ failProductInsert: true });
  await assert.rejects(h.run(), /falló|failure|simulated/i);
  assert.equal(h.state.markers[0].estado, 'fallido');
  assert.equal(h.state.collections.Categoria, undefined);
  assert.equal(h.state.collections.Atributo, undefined);
});

test('ejecuciones simultáneas adquieren un único bloqueo e inicializan una sola vez', async () => {
  let arrivals = 0;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const barrier = async () => {
    arrivals += 1;
    if (arrivals === 2) release();
    await gate;
  };
  const h = harness({ dataBarrier: barrier });
  const results = await Promise.allSettled([h.run(), h.run()]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(h.state.markers.length, 1);
  assert.equal(h.state.markers[0].estado, 'completado');
  assert.equal(h.state.collections.Producto.length, 3);
});

test('el seed no contiene operaciones destructivas ni inserta admins, banners o fechas especiales', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/seeders/seed.js'), 'utf8');
  assert.doesNotMatch(source, /deleteMany|deleteOne|dropDatabase|\.drop\(|replaceOne|bulkWrite/);
  assert.doesNotMatch(source, /models\.(Admin|Banner|RetiroEspecial)/);
  assert.equal(SEED_MARKER_ID, 'catalogo-inicial-v1');
});

test('el escaneo considera documentos existentes y excluye solo su propia marca', async () => {
  const data = {
    products: [{ _id: 'p1' }],
    seedinitializations: [{ _id: SEED_MARKER_ID }],
    empty: []
  };
  const db = {
    listCollections: () => ({ toArray: async () => Object.keys(data).map((name) => ({ name })) }),
    collection: (name) => ({ countDocuments: async (filter) => data[name].filter((doc) => !filter._id || String(doc._id) !== String(filter._id.$ne)).length })
  };
  assert.equal(await databaseHasData(null, 'seedinitializations', db), true);
  data.products = [];
  assert.equal(await databaseHasData(null, 'seedinitializations', db), false);
  data.seedinitializations.push({ _id: 'unexpected-control-doc' });
  assert.equal(await databaseHasData(null, 'seedinitializations', db), true);
});
