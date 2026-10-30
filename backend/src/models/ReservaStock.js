const { Schema, model } = require('mongoose');

const schema = new Schema({
  pedidoId: { type: Schema.Types.ObjectId, ref: 'Pedido', required: true },
  varianteId: { type: Schema.Types.ObjectId, ref: 'Variante', required: true },
  cantidad: { type: Number, required: true, min: 1, validate: Number.isInteger },
  estado: { type: String, enum: ['ACTIVA', 'CONFIRMADA', 'LIBERADA'], default: 'ACTIVA' },
  creadoEn: { type: Date, default: Date.now },
  venceEn: { type: Date, required: true },
  confirmadaEn: { type: Date, default: null },
  liberadaEn: { type: Date, default: null }
}, { timestamps: false, autoIndex: false });

schema.index({ pedidoId: 1, varianteId: 1 }, { unique: true, name: 'uniq_reserva_pedido_variante' });
schema.index({ estado: 1, venceEn: 1 }, { name: 'idx_reserva_estado_vencimiento' });
schema.index({ varianteId: 1, estado: 1, venceEn: 1 }, { name: 'idx_reserva_variante_estado_vencimiento' });
module.exports = model('ReservaStock', schema);
