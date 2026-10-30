const { Schema, model } = require('mongoose');
const schema = new Schema({
  productoId: { type: Schema.Types.ObjectId, ref: 'Producto', required: true },
  precio: { type: Schema.Types.Decimal128, default: null, min: 0 },
  stock: { type: Number, default: 0, min: 0, validate: Number.isInteger },
  // Contador de serialización para reservar/confirmar stock con compare-and-set.
  // Los documentos anteriores pueden carecer del campo; el primer cambio lo inicializa atómicamente.
  revisionReservas: { type: Number, default: 0, min: 0, validate: Number.isSafeInteger },
  claveSeed: { type: String, unique: true, sparse: true },
  // Se completa para documentos heredados mediante migración controlada.
  combinacionClave: { type: String, default: undefined },
  activa: { type: Boolean, default: true }
}, { timestamps: true, autoIndex: false });
schema.index({ productoId: 1 });
schema.index({ productoId: 1, activa: 1 });
schema.index(
  { productoId: 1, combinacionClave: 1 },
  {
    unique: true,
    name: 'uniq_variante_producto_combinacion_activa',
    partialFilterExpression: { activa: true, combinacionClave: { $type: 'string' } }
  }
);
module.exports = model('Variante', schema);
