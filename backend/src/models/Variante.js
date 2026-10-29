const { Schema, model } = require('mongoose');
const schema = new Schema({
  productoId: { type: Schema.Types.ObjectId, ref: 'Producto', required: true },
  precio: { type: Schema.Types.Decimal128, default: null, min: 0 },
  stock: { type: Number, default: 0, min: 0, validate: Number.isInteger },
  claveSeed: { type: String, unique: true, sparse: true },
  activa: { type: Boolean, default: true }
}, { timestamps: true });
schema.index({ productoId: 1 });
schema.index({ productoId: 1, activa: 1 });
module.exports = model('Variante', schema);
