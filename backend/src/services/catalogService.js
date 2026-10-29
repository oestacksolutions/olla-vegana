const AppError = require('../utils/AppError');

function calculateAvailableStock(stockFisico, reservas, ahora = new Date()) {
  const stock = Number.isFinite(Number(stockFisico)) ? Math.max(0, Number(stockFisico)) : 0;
  const unidadesReservadas = (reservas || []).reduce((total, reserva) => {
    if (reserva.estado !== 'ACTIVA') return total;

    const venceEn = new Date(reserva.venceEn);
    const cantidad = Number(reserva.cantidad);
    if (Number.isNaN(venceEn.getTime()) || venceEn <= ahora || !Number.isFinite(cantidad) || cantidad <= 0) {
      return total;
    }

    return total + cantidad;
  }, 0);

  return Math.max(0, stock - unidadesReservadas);
}

function createCatalogService(prisma, { ahora = () => new Date() } = {}) {
  async function listProducts(categoriaSlug) {
    const categoria = { activa: true };
    if (categoriaSlug) categoria.slug = categoriaSlug;

    return prisma.producto.findMany({
      where: {
        activo: true,
        categoria: { is: categoria }
      },
      orderBy: [
        { destacado: 'desc' },
        { creadoEn: 'desc' }
      ],
      select: {
        id: true,
        nombre: true,
        slug: true,
        precioBase: true,
        destacado: true,
        categoria: {
          select: { nombre: true, slug: true }
        }
      }
    });
  }

  async function getProductBySlug(slug) {
    const momentoConsulta = ahora();
    const producto = await prisma.producto.findFirst({
      where: {
        slug,
        activo: true,
        categoria: { is: { activa: true } }
      },
      select: {
        id: true,
        nombre: true,
        slug: true,
        descripcion: true,
        precioBase: true,
        destacado: true,
        categoria: {
          select: { nombre: true, slug: true }
        },
        imagenes: {
          orderBy: [
            { posicion: 'asc' },
            { id: 'asc' }
          ],
          select: { id: true, url: true, posicion: true }
        },
        variantes: {
          where: { activa: true },
          select: {
            id: true,
            precio: true,
            stock: true,
            valores: {
              select: {
                valorAtributo: {
                  select: {
                    valor: true,
                    atributo: { select: { nombre: true } }
                  }
                }
              }
            },
            reservas: {
              where: {
                estado: 'ACTIVA',
                venceEn: { gt: momentoConsulta }
              },
              select: { cantidad: true, estado: true, venceEn: true }
            }
          }
        }
      }
    });

    if (!producto) {
      throw AppError.noEncontrado('Producto no encontrado');
    }

    const variantes = producto.variantes.map((variante) => {
      const stockDisponible = calculateAvailableStock(
        variante.stock,
        variante.reservas,
        momentoConsulta
      );

      return {
        id: variante.id,
        precio: variante.precio,
        stockDisponible,
        agotada: stockDisponible === 0,
        valores: variante.valores.map(({ valorAtributo }) => ({
          atributo: valorAtributo.atributo.nombre,
          valor: valorAtributo.valor
        }))
      };
    });

    return {
      id: producto.id,
      nombre: producto.nombre,
      slug: producto.slug,
      descripcion: producto.descripcion,
      precioBase: producto.precioBase,
      destacado: producto.destacado,
      categoria: producto.categoria,
      imagenes: producto.imagenes,
      variantes
    };
  }

  async function listCategories() {
    return prisma.categoria.findMany({
      where: { activa: true },
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true, slug: true }
    });
  }

  return { listProducts, getProductBySlug, listCategories };
}

module.exports = { createCatalogService, calculateAvailableStock };
