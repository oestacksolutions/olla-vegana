const { Schema, model } = require('mongoose');

const estados = ['SOLICITADO', 'PREPARADO', 'EN_PROCESO', 'INDETERMINADO', 'PENDIENTE_MANUAL', 'COMPLETADO', 'FALLIDO', 'EN_REVISION'];
const historialSchema = new Schema({
  estado: { type: String, enum: estados, required: true },
  adminId: { type: Schema.Types.ObjectId, ref: 'Admin', default: null },
  nota: { type: String, default: null, maxlength: 1000 },
  creadoEn: { type: Date, default: Date.now }
}, { _id: false });

const schema = new Schema({
  pedidoId: { type: Schema.Types.ObjectId, ref: 'Pedido', required: true, index: true },
  metodoPago: { type: String, enum: ['MERCADO_PAGO', 'TRANSFERENCIA'], required: true },
  proveedor: { type: String, enum: ['MERCADO_PAGO', 'TRANSFERENCIA'], required: true },
  tipo: { type: String, enum: ['TOTAL', 'PARCIAL'], required: true },
  importeSolicitado: { type: Schema.Types.Decimal128, required: true, min: 0 },
  importeConfirmado: { type: Schema.Types.Decimal128, default: null, min: 0 },
  moneda: { type: String, enum: ['ARS'], default: 'ARS', required: true },
  estado: { type: String, enum: estados, required: true },
  motivo: { type: String, required: true, trim: true, maxlength: 500 },
  adminSolicitanteId: { type: Schema.Types.ObjectId, ref: 'Admin', required: true },
  adminResponsableId: { type: Schema.Types.ObjectId, ref: 'Admin', default: null },
  idOperacion: { type: String, required: true, trim: true, maxlength: 128 },
  huellaSolicitud: { type: String, required: true, select: false },
  proveedorOrderId: { type: String, default: null },
  proveedorPagoId: { type: String, default: null },
  proveedorReintegroId: { type: String, default: null },
  estadoProveedor: { type: String, default: null, maxlength: 80 },
  estadoDetalleProveedor: { type: String, default: null, maxlength: 120 },
  idConfirmacion: { type: String, default: undefined, maxlength: 128 },
  huellaConfirmacion: { type: String, default: undefined, select: false },
  referenciaDevolucion: { type: String, default: null, trim: true, maxlength: 120 },
  incidencia: { type: String, default: null, maxlength: 500 },
  solicitadoEn: { type: Date, required: true },
  procesadoEn: { type: Date, default: null },
  confirmadoEn: { type: Date, default: null },
  historial: { type: [historialSchema], default: [] }
}, { timestamps: { createdAt: 'creadoEn', updatedAt: 'actualizadoEn' }, autoIndex: false, autoCreate: false });

schema.index({ idOperacion: 1 }, { unique: true, name: 'uniq_reintegro_id_operacion' });
schema.index({ pedidoId: 1, creadoEn: -1 }, { name: 'idx_reintegro_pedido_fecha' });
schema.index({ pedidoId: 1, estado: 1 }, { name: 'idx_reintegro_pedido_estado' });
schema.index({ proveedorReintegroId: 1 }, {
  unique: true,
  name: 'uniq_reintegro_proveedor_id',
  partialFilterExpression: { proveedorReintegroId: { $type: 'string' } }
});
schema.index({ idConfirmacion: 1 }, {
  unique: true,
  name: 'uniq_reintegro_id_confirmacion',
  partialFilterExpression: { idConfirmacion: { $type: 'string' } }
});
schema.index({ pedidoId: 1, referenciaDevolucion: 1 }, {
  unique: true,
  name: 'uniq_reintegro_pedido_referencia_devolucion',
  partialFilterExpression: { referenciaDevolucion: { $type: 'string' } }
});

module.exports = model('Reintegro', schema);
