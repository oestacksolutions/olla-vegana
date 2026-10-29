const connectDB = require('../config/db');
const mongoose = require('mongoose');
const { randomUUID } = require('node:crypto');

const Categoria = require('../models/Categoria');
const Atributo = require('../models/Atributo');
const ValorAtributo = require('../models/ValorAtributo');
const Producto = require('../models/Producto');
const Variante = require('../models/Variante');
const ValorVariante = require('../models/ValorVariante');
const Configuracion = require('../models/Configuracion');
const SeedInitialization = require('../models/SeedInitialization');
const PuntoRetiro = require('../models/PuntoRetiro');

const SEED_MARKER_ID = 'catalogo-inicial-v1';

class SeedSafetyError extends Error {}

const categories = [
  { nombre: 'Remeras', slug: 'remeras' },
  { nombre: 'Gorras', slug: 'gorras' },
  { nombre: 'Tote bags', slug: 'tote-bags' }
];
const pickupPoints = [
  {
    nombre: 'Morón', direccion: null, activo: true, habilitadoCheckout: false,
    horariosHabituales: [
      { diaSemana: 'MARTES', horaInicio: '16:00', horaFin: '19:00' },
      { diaSemana: 'VIERNES', horaInicio: '16:00', horaFin: '19:00' }
    ]
  },
  {
    nombre: 'Moreno', direccion: null, activo: true, habilitadoCheckout: false,
    horariosHabituales: [{ diaSemana: 'VIERNES', horaInicio: '16:00', horaFin: '19:00' }]
  },
  {
    nombre: 'Ramos Mejía', direccion: null, activo: true, habilitadoCheckout: false,
    horariosHabituales: []
  }
];
const attributes = [
  { nombre: 'Talle', valores: ['S', 'M', 'L'] },
  { nombre: 'Color', valores: ['Negro', 'Beige'] },
  { nombre: 'Estampado', valores: ['Logo', 'Flores'] },
  { nombre: 'Material', valores: [] },
  { nombre: 'Medidas', valores: ['70 cm de largo × 40 cm de ancho'] }
];
const products = [
  {
    nombre: 'Remera “Nadie se salva solx”', slug: 'remera-nadie-se-salva-solx', precioBase: '45000.00', categoriaSlug: 'remeras',
    descripcion: 'Frente: Logo Olla Vegana “Est. 2019” (estilo pocket, 6 × 7 cm). Espalda: Estampa “Nadie se salva solx” + info de donaciones. Tela: 100% algodón peinado de primera calidad. Una prenda urbana, cómoda y con propósito. Todo lo recaudado se destina a financiar las acciones de Olla Vegana.',
    variantes: [
      { clave: 'talle-s', stock: 0, valores: [['Talle', 'S']] },
      { clave: 'talle-m', stock: 0, valores: [['Talle', 'M']] },
      { clave: 'talle-l', stock: 10, valores: [['Talle', 'L'], ['Medidas', '70 cm de largo × 40 cm de ancho']] }
    ]
  },
  {
    nombre: 'Gorra Olla Vegana', slug: 'gorra-olla-vegana', precioBase: '27000.00', categoriaSlug: 'gorras',
    descripcion: 'Completá tu look y sumate a la causa con nuestras gorras de gabardina. Disponibles en dos versiones para que elijas la que mejor va con tu estilo: color negro con nuestro logo en un trazo minimalista, o color beige con nuestra clásica vaquita a todo color. Ideales para el día a día, de visera curva y calce ajustable.',
    variantes: [
      { clave: 'color-negro', stock: 10, valores: [['Color', 'Negro']] },
      { clave: 'color-beige', stock: 10, valores: [['Color', 'Beige']] }
    ]
  },
  {
    nombre: 'Tote oficial Olla Vegana', slug: 'tote-oficial-olla-vegana', precioBase: '27000.00', categoriaSlug: 'tote-bags',
    descripcion: 'Cambiá las bolsas de plástico por una opción que además de cuidar el planeta, ayuda a sostener un proyecto autogestivo. Confeccionadas en gabardina resistente, podés llevarla con nuestro logo principal o con el detalle de las flores. Cada vez que usás esta tote bag, no solo estás llevando un diseño hermoso, sino que estás difundiendo nuestras redes y formas de donación.',
    variantes: [
      { clave: 'estampado-logo', stock: 10, valores: [['Estampado', 'Logo']] },
      { clave: 'estampado-flores', stock: 10, valores: [['Estampado', 'Flores']] }
    ]
  }
];

// Las direcciones quedan pendientes. Ramos Mejía no tiene días ni horarios confirmados.
// Los banners anteriores usaban URLs de ejemplo. No se insertan hasta contar con los datos reales.

function execute(query, session) {
  if (session && query && typeof query.session === 'function') query = query.session(session);
  return query && typeof query.lean === 'function' ? query.lean() : query;
}

async function insertOnly(Model, filter, document, session) {
  try {
    const found = await execute(Model.findOneAndUpdate(
      filter,
      { $setOnInsert: document },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true, session }
    ), session);
    if (found) return found;
  } catch (error) {
    if (!error || error.code !== 11000) throw error;
  }
  const existing = await execute(Model.findOne(filter), session);
  if (!existing) throw new Error('No se pudo resolver un registro inicial por su clave única.');
  return existing;
}

async function databaseHasData(session, markerCollectionName, db = mongoose.connection.db) {
  const collections = await db.listCollections({}, { nameOnly: true }).toArray();
  for (const { name } of collections) {
    if (name.startsWith('system.')) continue;
    const options = { limit: 1 };
    if (session) options.session = session;
    const filter = name === markerCollectionName ? { _id: { $ne: SEED_MARKER_ID } } : {};
    if (await db.collection(name).countDocuments(filter, options)) return true;
  }
  return false;
}

async function connectForSeed() {
  // El seed no debe crear índices o colecciones solo por conectarse a una base ajena.
  mongoose.set('autoIndex', false);
  mongoose.set('autoCreate', false);
  return connectDB();
}

function createSeedRunner({
  models, markerModel = SeedInitialization, connect = connectForSeed, disconnect = () => mongoose.disconnect(),
  startSession = () => mongoose.startSession(), hasBusinessData = databaseHasData,
  logger = console, tokenFactory = randomUUID
}) {
  return async function runSeed() {
    try {
      await connect();
      const markerCollectionName = markerModel.collection?.name || 'seedinitializations';
      const existingMarker = await execute(markerModel.findById(SEED_MARKER_ID));
      if (existingMarker) {
        if (existingMarker.estado === 'completado') {
          logger.log('Seed ya inicializado; no se modificó ningún documento.');
          return { estado: 'omitido' };
        }
        throw new SeedSafetyError('Hay una inicialización previa incompleta; se requiere revisión manual.');
      }

      // Primera barrera de solo lectura: datos sin marca nunca se adoptan ni modifican.
      if (await hasBusinessData(null, markerCollectionName)) {
        throw new SeedSafetyError('La base ya contiene datos y no tiene marca del seed; revisión manual requerida.');
      }

      const propietario = tokenFactory();
      let lock;
      try {
        lock = await execute(markerModel.findOneAndUpdate(
          { _id: SEED_MARKER_ID, estado: { $exists: false } },
          { $set: { estado: 'inicializando', propietario, iniciadoEn: new Date(), completadoEn: null } },
          { upsert: true, new: true, runValidators: true }
        ));
      } catch (error) {
        if (error && error.code === 11000) {
          throw new SeedSafetyError('Otra ejecución del seed ya tomó el bloqueo; no se modificó ningún dato.');
        }
        throw error;
      }
      if (!lock || lock.propietario !== propietario || lock.estado !== 'inicializando') {
        throw new SeedSafetyError('No se pudo obtener el bloqueo de inicialización.');
      }

      if (await hasBusinessData(null, markerCollectionName)) {
        await markerModel.updateOne(
          { _id: SEED_MARKER_ID, propietario },
          { $set: { estado: 'bloqueado' } }
        );
        throw new SeedSafetyError('Se detectaron datos durante el bloqueo; revisión manual requerida.');
      }

      const session = await startSession();
      try {
        await session.withTransaction(async () => {
          if (await hasBusinessData(session, markerCollectionName)) {
            throw new SeedSafetyError('La base dejó de estar vacía antes de iniciar la transacción.');
          }
          await seed(models, session);
          const markerUpdate = await markerModel.updateOne(
            { _id: SEED_MARKER_ID, propietario, estado: 'inicializando' },
            { $set: { estado: 'completado', completadoEn: new Date() } },
            { session }
          );
          if (markerUpdate.matchedCount !== 1) throw new SeedSafetyError('Se perdió el bloqueo antes de completar la inicialización.');
        });
      } catch (error) {
        await markerModel.updateOne(
          { _id: SEED_MARKER_ID, propietario, estado: 'inicializando' },
          { $set: { estado: 'fallido' } }
        );
        throw error;
      } finally {
        await session.endSession();
      }

      logger.log('Seed inicial completado transaccionalmente.');
      return { estado: 'completado' };
    } finally {
      await disconnect();
    }
  };
}

async function seed(models, session) {
      for (const point of pickupPoints) {
        await insertOnly(models.PuntoRetiro, { nombre: point.nombre }, point, session);
      }

      const categoriesBySlug = {};
      for (const spec of categories) {
        categoriesBySlug[spec.slug] = await insertOnly(models.Categoria, { slug: spec.slug }, { ...spec, activa: true }, session);
      }

      const valuesByAttribute = {};
      for (const spec of attributes) {
        const attribute = await insertOnly(models.Atributo, { nombre: spec.nombre }, { nombre: spec.nombre }, session);
        valuesByAttribute[spec.nombre] = {};
        for (const valor of spec.valores) {
          valuesByAttribute[spec.nombre][valor] = await insertOnly(
            models.ValorAtributo,
            { atributoId: attribute._id, valor },
            { atributoId: attribute._id, valor }, session
          );
        }
      }

      for (const spec of products) {
        const category = categoriesBySlug[spec.categoriaSlug];
        const product = await insertOnly(models.Producto, { slug: spec.slug }, {
          nombre: spec.nombre, slug: spec.slug, descripcion: spec.descripcion,
          precioBase: spec.precioBase, categoriaId: category._id, activo: true, destacado: false
        }, session);

        for (const variantSpec of spec.variantes) {
          const valueDocs = variantSpec.valores.map(([attributeName, value]) => valuesByAttribute[attributeName]?.[value]);
          if (valueDocs.some((value) => !value)) throw new Error('Falta un valor de atributo requerido por una variante inicial.');
          const targetIds = valueDocs.map((value) => String(value._id)).sort();
          const existingVariants = await execute(models.Variante.find({ productoId: product._id }), session);
          let exists = false;
          for (const variant of existingVariants) {
            const links = await execute(models.ValorVariante.find({ varianteId: variant._id }), session);
            const currentIds = links.map((link) => String(link.valorAtributoId)).sort();
            if (currentIds.length === targetIds.length && currentIds.every((id, index) => id === targetIds[index])) {
              exists = true;
              break;
            }
          }
          if (exists) continue;

          const claveSeed = `${spec.slug}:${variantSpec.clave}`;
          let variant;
          try {
            variant = await insertOnly(models.Variante, { claveSeed }, {
              claveSeed, productoId: product._id, stock: variantSpec.stock, activa: true
            }, session);
          } catch (error) {
            if (!error || error.code !== 11000) throw error;
            variant = await execute(models.Variante.findOne({ claveSeed }), session);
            if (!variant) throw error;
          }
          for (const value of valueDocs) {
            await insertOnly(models.ValorVariante,
              { varianteId: variant._id, valorAtributoId: value._id },
              { varianteId: variant._id, valorAtributoId: value._id }, session);
          }
        }
      }

      await insertOnly(models.Configuracion, { _id: 'reserva_stock_horas' }, { _id: 'reserva_stock_horas', valor: '24' }, session);
}

const defaultRunner = createSeedRunner({
  models: { Categoria, Atributo, ValorAtributo, Producto, Variante, ValorVariante, Configuracion, PuntoRetiro }
});

if (require.main === module) {
  defaultRunner().catch((error) => {
    if (error instanceof SeedSafetyError) console.error(error.message);
    else console.error('No se pudo completar el seed; revisar conexión y estado de inicialización antes de reintentar.');
    process.exitCode = 1;
  });
}

module.exports = { createSeedRunner, categories, attributes, products, pickupPoints, insertOnly, databaseHasData, SEED_MARKER_ID };
