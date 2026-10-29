const { Schema, model } = require('mongoose');

const estados = ['NUEVO', 'EN_PREPARACION', 'LISTO_PARA_RETIRAR', 'RETIRADO', 'CANCELADO'];
const schema = new Schema({
  pedidoId: { type: Schema.Types.ObjectId, ref: 'Pedido', required: true },
  estadoAnterior: { type: String, enum: estados, default: null },
  estadoNuevo: { type: String, enum: estados, required: true },
  nota: { type: String, default: null },
  adminId: { type: Schema.Types.ObjectId, ref: 'Admin', default: null },
  creadoEn: { type: Date, default: Date.now }
}, { timestamps: false });

schema.index({ pedidoId:  1, creadoEn: -1 });
module.exports = model('HistorialEstadoPedido', schema);
