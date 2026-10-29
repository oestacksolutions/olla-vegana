const { Schema, model } = require('mongoose');

const schema = new Schema({
  numero: { type: Number, required: true, unique: true, min: 1, validate: Number.isInteger },
  nombre: { type: String, required: true, trim: true },
  apellido: { type: String, required: true, trim: true },
  correo: { type: String, required: true, lowercase: true, trim: true, index: true },
  telefono: { type: String, default: null },
  metodoPago: { type: String, enum: ['MERCADO_PAGO', 'TRANSFERENCIA'], required: true },
  estadoPago: { type: String, enum: ['PENDIENTE', 'APROBADO', 'RECHAZADO', 'REEMBOLSADO'], default: 'PENDIENTE' },
  estado: { type: String, enum: ['NUEVO', 'EN_PREPARACION', 'LISTO_PARA_RETIRAR', 'RETIRADO', 'CANCELADO'], default: 'NUEVO' },
  total: { type: Schema.Types.Decimal128, required: true, min: 0 },
  puntoRetiroId: { type: Schema.Types.ObjectId, ref: 'PuntoRetiro', default: null },
  retiroEspecialId: { type: Schema.Types.ObjectId, ref: 'RetiroEspecial', default: null },
  mpPreferenciaId: { type: String, default: null },
  mpPagoId: { type: String, default: null },
  notaPago: { type: String, default: null },
  pagoVerificadoEn: { type: Date, default: null },
  pagadoEn: { type: Date, default: null },
  retiradoEn: { type: Date, default: null },
  venceEn: { type: Date, default: null }
}, { timestamps: { createdAt: 'creadoEn', updatedAt: false } });

schema.index({ estado: 1 });
schema.index({ estadoPago: 1 });
schema.index({ creadoEn: 1 });
schema.pre('validate', function validatePickupChoice() {
  const hasRegularPickup = Boolean(this.puntoRetiroId);
  const hasSpecialPickup = Boolean(this.retiroEspecialId);
  if (hasRegularPickup === hasSpecialPickup) {
    this.invalidate('puntoRetiroId', 'El pedido debe referenciar un único punto o retiro especial.');
  }
});
module.exports = model('Pedido', schema);
