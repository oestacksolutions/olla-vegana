const { Schema, model } = require('mongoose');

const schema = new Schema({
  pedidoId: { type: Schema.Types.ObjectId, ref: 'Pedido', required: true },
  proveedor: { type: String, enum: ['MERCADO_PAGO'], required: true },
  claveIdempotencia: { type: String, required: true },
  huellaSolicitud: { type: String, required: true },
  solicitud: { type: Schema.Types.Mixed, required: true },
  estadoCreacion: { type: String, enum: ['CREANDO', 'INDETERMINADO', 'CREADO', 'FALLIDO'], default: 'CREANDO', required: true },
  orderExternaId: { type: String, default: null },
  checkoutUrl: { type: String, default: null },
  codigoError: { type: String, default: null },
  respuestaRecibidaEn: { type: Date, default: null }
}, { timestamps: { createdAt: 'creadoEn', updatedAt: 'actualizadoEn' }, autoIndex: false, autoCreate: false });

schema.index({ proveedor: 1, claveIdempotencia: 1 }, { unique: true, name: 'uniq_intento_pago_idempotencia' });
schema.index({ pedidoId: 1, creadoEn: -1 }, { name: 'idx_intento_pago_pedido_fecha' });

module.exports = model('IntentoPago', schema);
