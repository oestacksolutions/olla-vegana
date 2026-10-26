import remeras from '../assets/brand/svgMagui/remeras.jpg'
import gorraBeige from '../assets/brand/svgMagui/gorra.JPG'
import gorraNegra from '../assets/brand/svgMagui/gorra-negra.JPG'
import tote from '../assets/brand/svgMagui/tote.JPG'
import toteFlores from '../assets/brand/svgMagui/tote-flores.JPG'

export const storeProducts = [
  {
    id: 'remera',
    category: 'remeras',
    name: 'Remera \u201cNadie se salva solx\u201d',
    price: 45000,
    image: remeras,
    alt: 'Remera de Olla Vegana',
    description: [
      'Frente: Logo Olla Vegana \u201cEst. 2019\u201d (estilo pocket, 6 \u00d7 7 cm).',
      'Espalda: Estampa \u201cNadie se salva solx\u201d + info de donaciones.',
      'Tela: 100% algod\u00f3n peinado de primera calidad. Una prenda urbana, c\u00f3moda y con prop\u00f3sito. Todo lo recaudado se destina a financiar las acciones de Olla Vegana.',
    ],
    sizes: ['S', 'M', 'L'],
    outOfStockSizes: ['S', 'M'],
    sizeMeasurements: { L: '70 cm de largo \u00d7 40 cm de ancho' },
  },
  {
    id: 'gorra',
    category: 'gorras',
    name: 'Gorra Olla Vegana',
    price: 27000,
    image: gorraBeige,
    alt: 'Gorra Olla Vegana',
    imageFit: 'contain',
    description: ['Complet\u00e1 tu look y sumate a la causa con nuestras gorras de gabardina. Disponibles en dos versiones para que elijas la que mejor va con tu estilo: color negro con nuestro logo en un trazo minimalista, o color beige con nuestra cl\u00e1sica vaquita a todo color. Ideales para el d\u00eda a d\u00eda, de visera curva y calce ajustable.'],
    colorVariants: [
      { label: 'Beige', color: '#D8C7A3', image: gorraBeige },
      { label: 'Negra', color: '#292621', image: gorraNegra },
    ],
  },
  {
    id: 'tote',
    category: 'totes',
    name: 'Tote oficial Olla Vegana',
    price: 27000,
    image: tote,
    alt: 'Tote bag de Olla Vegana',
    imageFit: 'contain',
    description: ['Cambi\u00e1 las bolsas de pl\u00e1stico por una opci\u00f3n que adem\u00e1s de cuidar el planeta, ayuda a sostener un proyecto autogestivo. Confeccionadas en gabardina resistente, pod\u00e9s llevarla con nuestro logo principal o con el detalle de las flores. Cada vez que us\u00e1s esta tote bag, no solo est\u00e1s llevando un dise\u00f1o hermoso, sino que est\u00e1s difundiendo nuestras redes y formas de donaci\u00f3n.'],
    models: [
      { label: 'Logo Olla Vegana', image: tote, imageFit: 'contain' },
      { label: 'Flores', image: toteFlores, imageFit: 'contain' },
    ],
  },
]

export const storeCategories = [
  ['Remeras', '/tienda?categoria=remeras', 'remeras'],
  ['Gorras', '/tienda?categoria=gorras', 'gorras'],
  ['Totes', '/tienda?categoria=totes', 'totes'],
]
