const { Schema, model } = require('mongoose');

const horarioSnapshotSchema = new Schema({
  diaSemana: { type: String },
  horaInicio: { type: String },
  horaFin: { type: String }
}, { _id: false });

const puntoSnapshotSchema = new Schema({
  nombre: { type: String },
  direccion: { type: String, default: null },
  indicaciones: { type: String, default: '' },
  zonaHoraria: { type: String, default: 'America/Argentina/Buenos_Aires' },
  horarios: { type: String, default: null },
  horariosHabituales: { type: [horarioSnapshotSchema], default: [] }
}, { _id: false });

const especialSnapshotSchema = new Schema({
  evento: { type: String },
  nombre: { type: String },
  fecha: { type: Date },
  fechaInicio: { type: Date },
  fechaFin: { type: Date },
  lugar: { type: String },
  direccion: { type: String, default: null },
  indicaciones: { type: String, default: '' },
  zonaHoraria: { type: String, default: 'America/Argentina/Buenos_Aires' },
  horaInicio: { type: String },
  horaFin: { type: String },
  horariosRetiro: { type: [new Schema({ fecha: Date, horaInicio: String, horaFin: String }, { _id: false })], default: [] }
}, { _id: false });

const schema = new Schema({
  numero: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
  nombre: { type: String, required: true, trim: true },
  apellido: { type: String, required: true, trim: true },
  correo: { type: String, required: true, lowercase: true, trim: true, index: true },
  telefono: { type: String, default: null },
  observaciones: { type: String, default: null, trim: true, maxlength: 1000 },
  metodoPago: { type: String, enum: ['MERCADO_PAGO', 'TRANSFERENCIA'], required: true },
  estadoPago: { type: String, enum: ['PENDIENTE', 'APROBADO', 'RECHAZADO', 'REEMBOLSADO'], default: 'PENDIENTE' },
  estado: { type: String, enum: ['NUEVO', 'EN_PREPARACION', 'LISTO_PARA_RETIRAR', 'RETIRADO', 'CANCELADO'], default: 'NUEVO' },
  estadoReintegro: { type: String, enum: ['SIN_REINTEGRO', 'PENDIENTE', 'PARCIAL', 'COMPLETO', 'EN_REVISION'], default: 'SIN_REINTEGRO' },
  revisionReintegros: { type: Number, default: 0, min: 0, validate: Number.isSafeInteger },
  canceladoEn: { type: Date, default: null },
  canceladoPorAdminId: { type: Schema.Types.ObjectId, ref: 'Admin', default: null },
  cancelacionMotivo: { type: String, default: null, maxlength: 500 },
  total: { type: Schema.Types.Decimal128, required: true, min: 0 },
  puntoRetiroId: { type: Schema.Types.ObjectId, ref: 'PuntoRetiro', default: null },
  retiroEspecialId: { type: Schema.Types.ObjectId, ref: 'RetiroEspecial', default: null },
  puntoRetiroSnapshot: { type: puntoSnapshotSchema, default: null },
  retiroEspecialSnapshot: { type: especialSnapshotSchema, default: null },
  idOperacion: { type: String, default: undefined, trim: true },
  huellaOperacion: { type: String, default: undefined, select: false },
  mpPreferenciaId: { type: String, default: null },
  mpPagoId: { type: String, default: null },
  notaPago: { type: String, default: null },
  transferenciaRecibidaEn: { type: Date, default: null },
  transferenciaReferencia: { type: String, default: null, maxlength: 120 },
  transferenciaRequiereConciliacion: { type: Boolean, default: false },
  pagoConfirmadoPorAdminId: { type: Schema.Types.ObjectId, ref: 'Admin', default: null },
  accesoPublicoHash: { type: String, default: undefined, select: false },
  accesoPublicoHasta: { type: Date, default: null },
  pagoVerificadoEn: { type: Date, default: null },
  pagadoEn: { type: Date, default: null },
  retiradoEn: { type: Date, default: null },
  venceEn: { type: Date, default: null }
}, { timestamps: { createdAt: 'creadoEn', updatedAt: 'actualizadoEn' }, autoIndex: false });

schema.index({ numero: 1 }, { unique: true, name: 'uniq_pedido_numero' });
schema.index({ idOperacion: 1 }, {
  unique: true,
  name: 'uniq_pedido_id_operacion',
  partialFilterExpression: { idOperacion: { $type: 'string' } }
});
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
