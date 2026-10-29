const OBJECT_ID = /^[a-f\d]{24}$/i;

/**
 * Clave estable del conjunto atributo/valor. La versión permite cambiar el
 * formato en una migración futura. "v1:none" representa una variante sin
 * atributos y evita que dos variantes activas sin atributos colisionen de
 * forma distinta a cualquier combinación con atributos.
 */
function canonicalCombinationKey(pairs) {
  if (!Array.isArray(pairs)) throw new TypeError('pairs debe ser un array');
  if (pairs.length === 0) return 'v1:none';

  const normalized = pairs.map(({ atributoId, valorAtributoId }) => {
    const attribute = String(atributoId || '').toLowerCase();
    const value = String(valorAtributoId || '').toLowerCase();
    if (!OBJECT_ID.test(attribute) || !OBJECT_ID.test(value)) {
      throw new TypeError('La combinación contiene identificadores inválidos');
    }
    return [attribute, value];
  }).sort(([attributeA, valueA], [attributeB, valueB]) => {
    const attributeOrder = attributeA < attributeB ? -1 : attributeA > attributeB ? 1 : 0;
    if (attributeOrder) return attributeOrder;
    return valueA < valueB ? -1 : valueA > valueB ? 1 : 0;
  });

  if (new Set(normalized.map(([attribute]) => attribute)).size !== normalized.length) {
    throw new TypeError('La combinación contiene más de un valor para un atributo');
  }

  return `v1:${normalized.map(([attribute, value]) => `${attribute}:${value}`).join('|')}`;
}

module.exports = { canonicalCombinationKey };
