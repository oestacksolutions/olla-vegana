const { Schema, model } = require('mongoose');

const schema = new Schema({
  varianteId: { type: Schema.Types.ObjectId, ref: 'Variante', required: true },
  tipo: { type: String, enum: ['INGRESO', 'AJUSTE', 'VENTA', 'DEVOLUCION'], required: true },
  cantidad: { type: Number, required: true, validate: Number.isInteger },
  motivo: { type: String, default: null },
  stockAnterior: { type: Number, default: null, validate: (value) => value == null || Number.isSafeInteger(value) },
  stockResultante: { type: Number, default: null, min: 0, validate: (value) => value == null || Number.isSafeInteger(value) },
  adminId: { type: Schema.Types.ObjectId, ref: 'Admin', default: null },
  idOperacion: { type: String, default: undefined, trim: true },
  creadoEn: { type: Date, default: Date.now }
}, { timestamps: false, autoIndex: false });

schema.index({ varianteId: 1, creadoEn: -1 });
schema.index(
  { idOperacion: 1 },
  {
    unique: true,
    name: 'uniq_movimiento_id_operacion',
    partialFilterExpression: { idOperacion: { $type: 'string' } }
  }
);
module.exports = model('MovimientoStock', schema);
