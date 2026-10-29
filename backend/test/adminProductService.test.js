const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Prisma } = require('@prisma/client');
const AppError = require('../src/utils/AppError');
const createAdminProductRoutes = require('../src/routes/adminProductRoutes');
const { createAdminProductService } = require('../src/services/adminProductService');
const { createAdminProductController } = require('../src/controllers/adminProductController');

const validProduct = {
  nombre: 'Remera Olla',
  slug: 'remera-olla',
  descripcion: 'Descripcion de prueba',
  precioBase: '45000.00',
  categoriaId: 'categoria-1'
};

function makePrisma(overrides = {}) {
  return {
    categoria: {
      findFirst: async () => ({ id: 'categoria-1' }),
      ...overrides.categoria
    },
    producto: {
      findMany: async () => [],
      findUnique: async () => null,
      create: async ({ data }) => ({ id: 'producto-1', ...data }),
      update: async ({ data }) => ({ id: 'producto-1', ...data }),
      ...overrides.producto
    }
  };
}

test('lista productos incluyendo ocultos y aplica filtros administrativos', async () => {
  let consulta;
  const prisma = makePrisma({
    producto: {
      findMany: async (args) => {
        consulta = args;
        return [{ id: 'oculto-1', activo: false, variantes: [{ stock: 4 }] }];
      }
    }
  });
  const service = createAdminProductService(prisma);

  const result = await service.listProducts({
    nombre: 'Remera',
    categoriaId: 'categoria-1',
    activo: false
  });

  assert.deepEqual(consulta.where, {
    nombre: { contains: 'Remera' },
    categoriaId: 'categoria-1',
    activo: false
  });
  assert.equal(consulta.select.activo, true);
  assert.equal(consulta.select.variantes.select.stock, true);
  assert.equal(result[0].activo, false);
});

test('el listado sin filtro de visibilidad no excluye productos ocultos', async () => {
  let consulta;
  const service = createAdminProductService(makePrisma({
    producto: { findMany: async (args) => { consulta = args; return []; } }
  }));

  await service.listProducts({});

  assert.equal(Object.hasOwn(consulta.where, 'activo'), false);
});

test('crea producto con Decimal Prisma y defaults de visibilidad', async () => {
  let categoryQuery;
  let createQuery;
  const service = createAdminProductService(makePrisma({
    categoria: {
      findFirst: async (args) => { categoryQuery = args; return { id: 'categoria-1' }; }
    },
    producto: {
      findUnique: async () => null,
      create: async (args) => { createQuery = args; return { id: 'producto-1', ...args.data }; }
    }
  }));

  await service.createProduct(validProduct);

  assert.deepEqual(categoryQuery.where, { id: 'categoria-1', activa: true });
  assert.ok(createQuery.data.precioBase instanceof Prisma.Decimal);
  assert.equal(createQuery.data.precioBase.toString(), '45000');
  assert.equal(createQuery.data.activo, true);
  assert.equal(createQuery.data.destacado, false);
  assert.equal(Object.hasOwn(createQuery.data, 'variantes'), false);
  assert.equal(Object.hasOwn(createQuery.data, 'imagenes'), false);
});

test('rechaza precio negativo y campos obligatorios ausentes', async () => {
  const service = createAdminProductService(makePrisma());

  await assert.rejects(service.createProduct({ ...validProduct, precioBase: '-0.01' }), (error) => {
    assert.ok(error instanceof AppError);
    assert.equal(error.statusCode, 400);
    return true;
  });
  await assert.rejects(service.createProduct({ slug: validProduct.slug }), (error) => {
    assert.equal(error.statusCode, 400);
    return true;
  });
});

test('rechaza categorias inexistentes o inactivas', async () => {
  const service = createAdminProductService(makePrisma({
    categoria: { findFirst: async () => null }
  }));

  await assert.rejects(service.createProduct(validProduct), (error) => {
    assert.equal(error.statusCode, 404);
    return true;
  });
});

test('rechaza slugs duplicados antes de crear', async () => {
  let createCalled = false;
  const service = createAdminProductService(makePrisma({
    producto: {
      findUnique: async () => ({ id: 'existente' }),
      create: async () => { createCalled = true; }
    }
  }));

  await assert.rejects(service.createProduct(validProduct), (error) => {
    assert.equal(error.statusCode, 409);
    return true;
  });
  assert.equal(createCalled, false);
});

test('traduce una carrera de unicidad de slug a conflicto', async () => {
  const service = createAdminProductService(makePrisma({
    producto: {
      findUnique: async () => null,
      create: async () => { throw { code: 'P2002' }; }
    }
  }));

  await assert.rejects(service.createProduct(validProduct), (error) => {
    assert.equal(error.statusCode, 409);
    assert.equal(error.message, 'Ya existe un producto con ese slug');
    return true;
  });
});

test('edita solo los campos permitidos y no toca stock ni relaciones historicas', async () => {
  let updateQuery;
  const service = createAdminProductService(makePrisma({
    producto: {
      update: async (args) => { updateQuery = args; return { id: 'producto-1', ...args.data }; }
    }
  }));

  await service.updateProduct('producto-1', {
    nombre: 'Nombre nuevo',
    precioBase: '27000.00',
    destacado: true
  });

  assert.deepEqual(updateQuery.data, {
    nombre: 'Nombre nuevo',
    precioBase: new Prisma.Decimal('27000.00'),
    destacado: true
  });
  assert.equal(Object.hasOwn(updateQuery.data, 'stock'), false);
  assert.equal(Object.hasOwn(updateQuery.data, 'variantes'), false);
  assert.equal(Object.hasOwn(updateQuery.data, 'itemsPedido'), false);
  assert.equal(Object.hasOwn(updateQuery.data, 'movimientos'), false);
});

test('rechaza campos inesperados en creacion y edicion', async () => {
  const service = createAdminProductService(makePrisma());

  await assert.rejects(service.createProduct({ ...validProduct, variantes: [] }), (error) => {
    assert.equal(error.statusCode, 400);
    return true;
  });
  await assert.rejects(service.updateProduct('producto-1', { stock: 100 }), (error) => {
    assert.equal(error.statusCode, 400);
    return true;
  });
});

test('edicion y visibilidad de un producto inexistente responden 404', async () => {
  const service = createAdminProductService(makePrisma({
    producto: {
      update: async () => { throw { code: 'P2025' }; }
    }
  }));

  await assert.rejects(service.updateProduct('ausente', { destacado: true }), (error) => {
    assert.equal(error.statusCode, 404);
    return true;
  });
  await assert.rejects(service.setVisibility('ausente', false), (error) => {
    assert.equal(error.statusCode, 404);
    return true;
  });
});

test('publica y oculta mediante el unico campo activo', async () => {
  const updates = [];
  const service = createAdminProductService(makePrisma({
    producto: {
      update: async ({ data }) => { updates.push(data); return { id: 'producto-1', ...data }; }
    }
  }));

  await service.setVisibility('producto-1', true);
  await service.setVisibility('producto-1', false);

  assert.deepEqual(updates, [{ activo: true }, { activo: false }]);
  await assert.rejects(service.setVisibility('producto-1', 'false'), (error) => {
    assert.equal(error.statusCode, 400);
    return true;
  });
});

test('controller responde 201 al crear y reenvia errores al middleware global', async () => {
  const controller = createAdminProductController({
    createProduct: async () => ({ id: 'producto-1' }),
    listProducts: async () => { throw new Error('error simulado'); }
  });
  let statusCode;
  let body;

  await new Promise((resolve) => {
    controller.create({ body: validProduct }, {
      status(code) { statusCode = code; return this; },
      json(value) { body = value; resolve(); }
    }, resolve);
  });
  assert.equal(statusCode, 201);
  assert.equal(body.id, 'producto-1');

  const error = await new Promise((resolve) => {
    controller.list({ query: {} }, {}, resolve);
  });
  assert.equal(error.message, 'error simulado');
});

test('las rutas administrativas no estan montadas en la app publica y no tienen DELETE', () => {
  const appSource = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf8');
  assert.doesNotMatch(appSource, /adminProductRoutes|\/api\/admin\/products/);

  const routes = createAdminProductRoutes(makePrisma());
  const routeDefinitions = routes.stack
    .filter((layer) => layer.route)
    .map((layer) => ({ path: layer.route.path, methods: Object.keys(layer.route.methods) }));

  assert.deepEqual(routeDefinitions, [
    { path: '/', methods: ['get'] },
    { path: '/', methods: ['post'] },
    { path: '/:id/visibility', methods: ['patch'] },
    { path: '/:id', methods: ['patch'] }
  ]);
});
