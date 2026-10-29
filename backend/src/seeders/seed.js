require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');

// Importar modelos de Mongoose
const Admin = require('../models/Admin');
const Categoria = require('../models/Categoria');
const Atributo = require('../models/Atributo');
const ValorAtributo = require('../models/ValorAtributo');
const Producto = require('../models/Producto');
const Variante = require('../models/Variante');
const ValorVariante = require('../models/ValorVariante');
const PuntoRetiro = require('../models/PuntoRetiro');
const Banner = require('../models/Banner');
const Configuracion = require('../models/Configuracion');

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
  { nombre: 'Medidas', valores: ['70 cm de largo × 40 cm de ancho'] }
];

const products = [
  {
    nombre: 'Remera “Nadie se salva solx”',
    slug: 'remera-nadie-se-salva-solx',
    precioBase: 45000.00,
    categoriaSlug: 'remeras',
    descripcion: 'Frente: Logo Olla Vegana “Est. 2019” (estilo pocket, 6 × 7 cm). Espalda: Estampa “Nadie se salva solx” + info de donaciones. Tela: 100% algodón peinado de primera calidad. Una prenda urbana, cómoda y con propósito. Todo lo recaudado se destina a financiar las acciones de Olla Vegana.',
    variantes: [
      { stock: 0, valores: [['Talle', 'S']] },
      { stock: 0, valores: [['Talle', 'M']] },
      { stock: 10, valores: [['Talle', 'L'], ['Medidas', '70 cm de largo × 40 cm de ancho']] }
    ]
  },
  {
    nombre: 'Gorra Olla Vegana',
    slug: 'gorra-olla-vegana',
    precioBase: 27000.00,
    categoriaSlug: 'gorras',
    descripcion: 'Completá tu look y sumate a la causa con nuestras gorras de gabardina. Disponibles en dos versiones para que elijas la que mejor va con tu estilo: color negro con nuestro logo en un trazo minimalista, o color beige con nuestra clásica vaquita a todo color. Ideales para el día a día, de visera curva y calce ajustable.',
    variantes: [
      { stock: 10, valores: [['Color', 'Negro']] },
      { stock: 10, valores: [['Color', 'Beige']] }
    ]
  },
  {
    nombre: 'Tote oficial Olla Vegana',
    slug: 'tote-oficial-olla-vegana',
    precioBase: 27000.00,
    categoriaSlug: 'tote-bags',
    descripcion: 'Cambiá las bolsas de plástico por una opción que además de cuidar el planeta, ayuda a sostener un proyecto autogestivo. Confeccionadas en gabardina resistente, podés llevarla con nuestro logo principal o con el detalle de las flores. Cada vez que usás esta tote bag, no solo estás llevando un diseño hermoso, sino que estás difundiendo nuestras redes y formas de donación.',
    variantes: [
      { stock: 10, valores: [['Estampado', 'Logo']] },
      { stock: 10, valores: [['Estampado', 'Flores']] }
    ]
  }
];

const puntosRetiro = [
  { nombre: 'Morón Centro', direccion: 'Nuestra Señora del Buen Viaje 800, Morón', horarios: 'Sábados de 10:00 a 14:00 hs', activo: true },
  { nombre: 'Ramos Mejía', direccion: 'Av. de Mayo 1200, Ramos Mejía', horarios: 'Viernes de 15:00 a 19:00 hs', activo: true },
  { nombre: 'Moreno', direccion: 'Plaza Buján / Acceso Oeste, Moreno', horarios: 'Sábados de 11:00 a 13:00 hs', activo: true }
];

const banners = [
  { imagenUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=80', dispositivo: 'ESCRITORIO', posicion: 1, activo: true },
  { imagenUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80', dispositivo: 'CELULAR', posicion: 1, activo: true }
];

async function runSeed() {
  try {
    await connectDB();
    console.log('🌱 Iniciando siembra de datos con Mongoose...');

    await Admin.findOneAndUpdate(
      { correo: 'admin@ollavegana.com' },
      { contrasena: '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', activo: true },
      { upsert: true, new: true }
    );

    for (const punto of puntosRetiro) {
      await PuntoRetiro.findOneAndUpdate({ nombre: punto.nombre }, punto, { upsert: true, new: true });
    }

    const bannerCount = await Banner.countDocuments();
    if (bannerCount === 0) {
      await Banner.insertMany(banners);
    }

    const categoriesBySlug = {};
    for (const spec of categories) {
      const cat = await Categoria.findOneAndUpdate(
        { slug: spec.slug },
        { ...spec, activa: true },
        { upsert: true, new: true }
      );
      categoriesBySlug[spec.slug] = cat;
    }

    const valuesByAttribute = {};
    for (const spec of attributes) {
      const attribute = await Atributo.findOneAndUpdate(
        { nombre: spec.nombre },
        { nombre: spec.nombre },
        { upsert: true, new: true }
      );
      valuesByAttribute[spec.nombre] = {};

      for (const valor of spec.valores) {
        const attributeValue = await ValorAtributo.findOneAndUpdate(
          { atributoId: attribute._id, valor },
          { atributoId: attribute._id, valor },
          { upsert: true, new: true }
        );
        valuesByAttribute[spec.nombre][valor] = attributeValue;
      }
    }

    for (const spec of products) {
      const category = categoriesBySlug[spec.categoriaSlug];
      const product = await Producto.findOneAndUpdate(
        { slug: spec.slug },
        {
          nombre: spec.nombre,
          slug: spec.slug,
          descripcion: spec.descripcion,
          precioBase: spec.precioBase,
          activo: true,
          categoriaId: category._id
        },
        { upsert: true, new: true }
      );

      for (const variantSpec of spec.variantes) {
        const attributeValueIds = variantSpec.valores.map(([attributeName, value]) => {
          const attributeValue = valuesByAttribute[attributeName]?.[value];
          if (!attributeValue) {
            throw new Error(`No se encontró el valor ${value} del atributo ${attributeName}`);
          }
          return attributeValue._id;
        });

        const existingVariants = await Variante.find({ productoId: product._id });
        let matchedVariant = null;

        for (const ev of existingVariants) {
          const vvList = await ValorVariante.find({ varianteId: ev._id });
          const currentIds = vvList.map(v => v.valorAtributoId.toString()).sort();
          const targetIds = attributeValueIds.map(id => id.toString()).sort();

          if (currentIds.length === targetIds.length && currentIds.every((id, i) => id === targetIds[i])) {
            matchedVariant = ev;
            break;
          }
        }

        if (!matchedVariant) {
          const newVariant = await Variante.create({
            productoId: product._id,
            stock: variantSpec.stock,
            activa: true
          });

          for (const valId of attributeValueIds) {
            await ValorVariante.create({
              varianteId: newVariant._id,
              valorAtributoId: valId
            });
          }
        }
      }
    }

    await Configuracion.findOneAndUpdate(
      { _id: 'reserva_stock_horas' },
      { valor: '24' },
      { upsert: true, new: true }
    );

    console.log('✅ ¡Base de datos sembrada y poblada con éxito usando Mongoose!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error al ejecutar el seed:', error);
    process.exit(1);
  }
}

runSeed();
