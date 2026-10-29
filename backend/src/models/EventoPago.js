const { Schema, model } = require('mongoose');

const schema = new Schema({
  proveedor: { type: String, required: true, trim: true },
  idExterno: { type: String, required: true, trim: true },
  tipo: { type: String, required: true },
  contenido: { type: Schema.Types.Mixed, required: true },
  pedidoId: { type: Schema.Types.ObjectId, ref: 'Pedido', default: null },
  procesadoEn: { type: Date, default: null },
  creadoEn: { type: Date, default: Date.now }
}, { timestamps: false });

// No se fuerza unicidad hasta confirmar si idExterno identifica notificaciones o pagos.
schema.index({ idExterno: 1 });
schema.index({ pedidoId: 1 });
module.exports = model('EventoPago', schema);
