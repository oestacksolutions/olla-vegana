const { Schema, model } = require('mongoose');

const schema = new Schema({
  varianteId: { type: Schema.Types.ObjectId, ref: 'Variante', required: true },
  tipo: { type: String, enum: ['INGRESO', 'AJUSTE', 'VENTA', 'DEVOLUCION'], required: true },
  cantidad: { type: Number, required: true, validate: Number.isInteger },
  motivo: { type: String, default: null },
  creadoEn: { type: Date, default: Date.now }
}, { timestamps: false });

schema.index({ varianteId: 1, creadoEn: -1 });
module.exports = model('MovimientoStock', schema);
