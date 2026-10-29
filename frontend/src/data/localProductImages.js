const remeraFrente = new URL('../assets/jpg/remera-frente.jpg', import.meta.url).href
const remeras = new URL('../assets/jpg/remeras.jpg', import.meta.url).href
const gorraBeige = new URL('../assets/jpg/gorra.JPG', import.meta.url).href
const gorraNegra = new URL('../assets/jpg/gorra-negra.JPG', import.meta.url).href
const toteLogo = new URL('../assets/jpg/tote.JPG', import.meta.url).href
const toteFlores = new URL('../assets/jpg/tote-flores.JPG', import.meta.url).href

const imagesByProductSlug = {
  'remera-nadie-se-salva-solx': [
    { id: 'local-remera-principal', url: remeras, posicion: 0, esPrincipal: true, textoAlternativo: 'Remeras Olla Vegana con la estampa Nadie se salva solx' },
    { id: 'local-remera-frente', url: remeraFrente, posicion: 1, esPrincipal: false, textoAlternativo: 'Frente de la remera Olla Vegana' },
  ],
  'gorra-olla-vegana': [
    { id: 'local-gorra-beige', url: gorraBeige, posicion: 0, esPrincipal: true, textoAlternativo: 'Gorra beige Olla Vegana', valores: [{ atributo: 'Color', valor: 'Beige' }] },
    { id: 'local-gorra-negra', url: gorraNegra, posicion: 1, esPrincipal: false, textoAlternativo: 'Gorra negra Olla Vegana', valores: [{ atributo: 'Color', valor: 'Negro' }] },
  ],
  'tote-oficial-olla-vegana': [
    { id: 'local-tote-logo', url: toteLogo, posicion: 0, esPrincipal: true, textoAlternativo: 'Tote Olla Vegana con diseño de la vaca', valores: [{ atributo: 'Estampado', valor: 'Logo' }] },
    { id: 'local-tote-flores', url: toteFlores, posicion: 1, esPrincipal: false, textoAlternativo: 'Tote Olla Vegana con diseño de flores', valores: [{ atributo: 'Estampado', valor: 'Flores' }] },
  ],
}

export function getLocalProductImages(slug) {
  return imagesByProductSlug[slug] || []
}

export function getLocalPrimaryProductImage(slug) {
  return getLocalProductImages(slug)[0] || null
}
