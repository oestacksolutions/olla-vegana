const { Schema, model } = require('mongoose');

const schema = new Schema({
  proveedor: { type: String, required: true, trim: true },
  idExterno: { type: String, required: true, trim: true },
  tipo: { type: String, required: true },
  contenido: { type: Schema.Types.Mixed, required: true },
  idempotencia: { type: String, default: undefined },
  estadoProcesamiento: { type: String, enum: ['RECIBIDO', 'PROCESANDO', 'PROCESADO', 'REVISION', 'NO_APLICA'], default: 'RECIBIDO' },
  xRequestId: { type: String, default: null },
  errorCodigo: { type: String, default: null },
  pedidoId: { type: Schema.Types.ObjectId, ref: 'Pedido', default: null },
  procesadoEn: { type: Date, default: null },
  creadoEn: { type: Date, default: Date.now }
}, { timestamps: false, autoIndex: false, autoCreate: false });

schema.index({ idExterno: 1 });
schema.index({ pedidoId: 1 });
schema.index({ idempotencia: 1 }, {
  unique: true,
  name: 'uniq_evento_pago_idempotencia',
  partialFilterExpression: { idempotencia: { $type: 'string' } }
});
schema.index({ estadoProcesamiento: 1, creadoEn: 1 }, { name: 'idx_evento_pago_pendiente' });
module.exports = model('EventoPago', schema);
