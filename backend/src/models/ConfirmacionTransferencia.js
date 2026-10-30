const { Schema, model } = require('mongoose');

const schema = new Schema({
  pedidoId: { type: Schema.Types.ObjectId, ref: 'Pedido', required: true },
  adminId: { type: Schema.Types.ObjectId, ref: 'Admin', required: true },
  idOperacion: { type: String, required: true, minlength: 8, maxlength: 128 },
  huellaSolicitud: { type: String, required: true, select: false },
  referencia: { type: String, required: true, maxlength: 120 },
  importeAcreditado: { type: Schema.Types.Decimal128, required: true, min: 0 },
  resultado: { type: String, enum: ['ACREDITADA', 'TARDIA'], required: true },
  recibidoEn: { type: Date, required: true },
  creadoEn: { type: Date, default: Date.now }
}, { timestamps: false, autoIndex: false, autoCreate: false });

schema.index({ idOperacion: 1 }, { unique: true, name: 'uniq_confirmacion_transferencia_operacion' });
schema.index({ pedidoId: 1, referencia: 1 }, { unique: true, name: 'uniq_confirmacion_transferencia_referencia' });
schema.index({ pedidoId: 1, creadoEn: -1 }, { name: 'idx_confirmacion_transferencia_pedido_fecha' });

module.exports = model('ConfirmacionTransferencia', schema);
