const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

function createCatalogController(catalogService) {
  return {
    listProducts: asyncHandler(async (req, res) => {
      const categoria = req.query.categoria;
      if (categoria !== undefined && (typeof categoria !== 'string' || !categoria.trim())) {
        throw AppError.solicitudInvalida('El filtro categoria debe ser un slug unico');
      }

      const productos = await catalogService.listProducts(categoria?.trim());
      res.json(productos);
    }),

    getProduct: asyncHandler(async (req, res) => {
      const producto = await catalogService.getProductBySlug(req.params.slug);
      res.json(producto);
    }),

    listCategories: asyncHandler(async (_req, res) => {
      const categorias = await catalogService.listCategories();
      res.json(categorias);
    })
  };
}

module.exports = createCatalogController;
