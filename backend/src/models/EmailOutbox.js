const { Schema, model } = require('mongoose');

const schema = new Schema({
  _id: { type: String },
  pedidoId: { type: Schema.Types.ObjectId, ref: 'Pedido', required: true },
  tipo: { type: String, enum: ['PEDIDO_CREADO', 'PAGO_CONFIRMADO', 'PEDIDO_CANCELADO', 'LISTO_PARA_RETIRAR'], required: true },
  estado: { type: String, enum: ['PENDIENTE', 'EN_PROCESO', 'ENVIADO', 'FALLIDO', 'INDETERMINADO'], default: 'PENDIENTE', required: true },
  intentos: { type: Number, default: 0, min: 0 },
  proximoIntentoEn: { type: Date, default: Date.now },
  claimId: { type: String, default: null },
  claimHasta: { type: Date, default: null },
  envioIniciadoEn: { type: Date, default: null },
  enviadoEn: { type: Date, default: null },
  proveedorMessageId: { type: String, default: null },
  errorCodigo: { type: String, default: null, maxlength: 100 },
  creadoEn: { type: Date, default: Date.now },
  actualizadoEn: { type: Date, default: Date.now }
}, { versionKey: false, autoIndex: false, autoCreate: false });

schema.index({ estado: 1, proximoIntentoEn: 1, creadoEn: 1 }, { name: 'email_outbox_worker' });

module.exports = model('EmailOutbox', schema);
