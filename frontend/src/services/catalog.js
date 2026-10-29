import { getCategories as requestCategories, getProducts } from './api'
import { mapProductSummary } from '../utils/catalogMapping'
export { mapProductSummary } from '../utils/catalogMapping'

let cachedCategories
let categoriesRequest

export function getCategories({ refresh = false } = {}) {
  if (refresh) cachedCategories = undefined
  if (cachedCategories) return Promise.resolve(cachedCategories)
  if (!categoriesRequest) {
    categoriesRequest = requestCategories()
      .then((categories) => { cachedCategories = categories; return categories })
      .finally(() => { categoriesRequest = undefined })
  }
  return categoriesRequest
}

export async function fetchStoreProducts(category) {
  const summaries = await getProducts(category)
  return summaries.map(mapProductSummary)
}
