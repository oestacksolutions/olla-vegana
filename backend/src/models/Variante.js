const { Schema, model } = require('mongoose');
module.exports = model('Variante', new Schema({
  productoId: { type: Schema.Types.ObjectId, ref: 'Producto', required: true },
  precio: { type: Number, default: null },
  stock: { type: Number, default: 0 },
  activa: { type: Boolean, default: true }
}, { timestamps: true }));
