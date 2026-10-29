const { Schema, model } = require('mongoose');

const schema = new Schema({
  pedidoId: { type: Schema.Types.ObjectId, ref: 'Pedido', required: true },
  productoId: { type: Schema.Types.ObjectId, ref: 'Producto', required: true },
  varianteId: { type: Schema.Types.ObjectId, ref: 'Variante', default: null },
  nombreProducto: { type: String, required: true },
  detalleVariante: { type: String, default: null },
  cantidad: { type: Number, required: true, min: 1, validate: Number.isInteger },
  precio: { type: Schema.Types.Decimal128, required: true, min: 0 }
}, { timestamps: false });

schema.index({ pedidoId: 1 });
module.exports = model('ItemPedido', schema);
