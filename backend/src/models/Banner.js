const { Schema, model } = require('mongoose');
module.exports = model('Banner', new Schema({
  imagenUrl: { type: String, required: true },
  dispositivo: { type: String, enum: ['ESCRITORIO', 'CELULAR'], required: true },
  posicion: { type: Number, default: 0 },
  posicionImagen: { type: String, default: 'center' },
  terminaEn: { type: Date },
  activo: { type: Boolean, default: true }
}, { timestamps: true }));
