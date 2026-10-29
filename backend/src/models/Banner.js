const { Schema, model } = require('mongoose');
const schema = new Schema({
  imagenUrl: { type: String, required: true },
  dispositivo: { type: String, enum: ['ESCRITORIO', 'CELULAR'], required: true },
  posicion: { type: Number, default: 0 },
  posicionImagen: { type: String, default: 'center' },
  terminaEn: { type: Date },
  activo: { type: Boolean, default: true }
}, { timestamps: true });
schema.index({ dispositivo: 1, activo: 1, posicion: 1 });
module.exports = model('Banner', schema);
