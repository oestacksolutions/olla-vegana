const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const categories = [
  { nombre: 'Remeras', slug: 'remeras' },
  { nombre: 'Gorras', slug: 'gorras' },
  { nombre: 'Tote bags', slug: 'tote-bags' }
];

const attributes = [
  { nombre: 'Talle', valores: ['S', 'M', 'L'] },
  { nombre: 'Color', valores: ['Negro', 'Beige'] },
  { nombre: 'Estampado', valores: ['Logo', 'Flores'] },
  { nombre: 'Material', valores: [] },
  { nombre: 'Medidas', valores: ['70 cm de largo \u00d7 40 cm de ancho'] }
];

const products = [
  {
    nombre: 'Remera \u201cNadie se salva solx\u201d',
    slug: 'remera-nadie-se-salva-solx',
    precioBase: '45000.00',
    categoriaSlug: 'remeras',
    descripcion: 'Frente: Logo Olla Vegana \u201cEst. 2019\u201d (estilo pocket, 6 \u00d7 7 cm). Espalda: Estampa \u201cNadie se salva solx\u201d + info de donaciones. Tela: 100% algod\u00f3n peinado de primera calidad. Una prenda urbana, c\u00f3moda y con prop\u00f3sito. Todo lo recaudado se destina a financiar las acciones de Olla Vegana.',
    variantes: [
      { id: '00000000-0000-4000-8000-000000000001', stock: 0, valores: [['Talle', 'S']] },
      { id: '00000000-0000-4000-8000-000000000002', stock: 0, valores: [['Talle', 'M']] },
      {
        id: '00000000-0000-4000-8000-000000000003',
        stock: 10,
        valores: [
          ['Talle', 'L'],
          ['Medidas', '70 cm de largo \u00d7 40 cm de ancho']
        ]
      }
    ]
  },
  {
    nombre: 'Gorra Olla Vegana',
    slug: 'gorra-olla-vegana',
    precioBase: '27000.00',
    categoriaSlug: 'gorras',
    descripcion: 'Complet\u00e1 tu look y sumate a la causa con nuestras gorras de gabardina. Disponibles en dos versiones para que elijas la que mejor va con tu estilo: color negro con nuestro logo en un trazo minimalista, o color beige con nuestra cl\u00e1sica vaquita a todo color. Ideales para el d\u00eda a d\u00eda, de visera curva y calce ajustable.',
    variantes: [
      { id: '00000000-0000-4000-8000-000000000004', stock: 10, valores: [['Color', 'Negro']] },
      { id: '00000000-0000-4000-8000-000000000005', stock: 10, valores: [['Color', 'Beige']] }
    ]
  },
  {
    nombre: 'Tote oficial Olla Vegana',
    slug: 'tote-oficial-olla-vegana',
    precioBase: '27000.00',
    categoriaSlug: 'tote-bags',
    descripcion: 'Cambi\u00e1 las bolsas de pl\u00e1stico por una opci\u00f3n que adem\u00e1s de cuidar el planeta, ayuda a sostener un proyecto autogestivo. Confeccionadas en gabardina resistente, pod\u00e9s llevarla con nuestro logo principal o con el detalle de las flores. Cada vez que us\u00e1s esta tote bag, no solo est\u00e1s llevando un dise\u00f1o hermoso, sino que est\u00e1s difundiendo nuestras redes y formas de donaci\u00f3n.',
    variantes: [
      { id: '00000000-0000-4000-8000-000000000006', stock: 10, valores: [['Estampado', 'Logo']] },
      { id: '00000000-0000-4000-8000-000000000007', stock: 10, valores: [['Estampado', 'Flores']] }
    ]
  }
];

async function upsertVariant(tx, productoId, spec, valueIds) {
  const expectedValueIds = [...valueIds].sort();
  const existingVariants = await tx.variante.findMany({
    where: { productoId },
    select: {
      id: true,
      valores: { select: { valorAtributoId: true } }
    }
  });

  const matchingVariant = existingVariants.find((variant) => {
    const existingValueIds = variant.valores
      .map((value) => value.valorAtributoId)
      .sort();
    return existingValueIds.length === expectedValueIds.length &&
      existingValueIds.every((id, index) => id === expectedValueIds[index]);
  });
  if (matchingVariant) return matchingVariant;

  const idCollision = await tx.variante.findUnique({
    where: { id: spec.id },
    select: { id: true, productoId: true }
  });
  if (idCollision) {
    throw new Error(`El ID determinista de la variante ya existe con otra combinacion: ${spec.id}`);
  }

  return tx.variante.upsert({
    where: { id: spec.id },
    update: {},
    create: {
      id: spec.id,
      productoId,
      stock: spec.stock,
      activa: true,
      valores: {
        create: valueIds.map((valorAtributoId) => ({
          valorAtributo: { connect: { id: valorAtributoId } }
        }))
      }
    }
  });
}

async function seed(tx) {
  const categoriesBySlug = {};
  for (const spec of categories) {
    categoriesBySlug[spec.slug] = await tx.categoria.upsert({
      where: { slug: spec.slug },
      update: {},
      create: { ...spec, activa: true }
    });
  }

  const valuesByAttribute = {};
  for (const spec of attributes) {
    const attribute = await tx.atributo.upsert({
      where: { nombre: spec.nombre },
      update: {},
      create: { nombre: spec.nombre }
    });
    valuesByAttribute[spec.nombre] = {};

    for (const valor of spec.valores) {
      const attributeValue = await tx.valorAtributo.upsert({
        where: {
          atributoId_valor: {
            atributoId: attribute.id,
            valor
          }
        },
        update: {},
        create: { atributoId: attribute.id, valor }
      });
      valuesByAttribute[spec.nombre][valor] = attributeValue;
    }
  }

  for (const spec of products) {
    const category = categoriesBySlug[spec.categoriaSlug];
    const product = await tx.producto.upsert({
      where: { slug: spec.slug },
      update: {},
      create: {
        nombre: spec.nombre,
        slug: spec.slug,
        descripcion: spec.descripcion,
        precioBase: spec.precioBase,
        activo: true,
        categoria: { connect: { id: category.id } }
      }
    });

    for (const variantSpec of spec.variantes) {
      const attributeValues = variantSpec.valores.map(([attributeName, value]) => {
        const attributeValue = valuesByAttribute[attributeName]?.[value];
        if (!attributeValue) {
          throw new Error(`No se encontro el valor ${value} del atributo ${attributeName}`);
        }
        return attributeValue.id;
      });
      await upsertVariant(tx, product.id, variantSpec, attributeValues);
    }
  }

  await tx.configuracion.upsert({
    where: { clave: 'reserva_stock_horas' },
    update: { valor: '24' },
    create: { clave: 'reserva_stock_horas', valor: '24' }
  });
}

async function main() {
  await prisma.$transaction((tx) => seed(tx));
}

async function run() {
  try {
    await main();
    console.log('Datos iniciales cargados correctamente.');
  } catch (error) {
    console.error('No se pudo completar el seed.', error.code || error.name || 'Error');
    process.exitCode = 1;
  } finally {
    try {
      await prisma.$disconnect();
    } catch (_error) {
      console.error('No se pudo cerrar la conexion de Prisma.');
      process.exitCode = 1;
    }
  }
}

// Puntos de retiro pendientes: Moron, Ramos Mejia y Moreno.
// Completar direccion y horarios reales antes de crear registros.

if (require.main === module) {
  run();
}
