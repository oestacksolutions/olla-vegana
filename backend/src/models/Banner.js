const { Schema, model } = require('mongoose');
const schema = new Schema({
  imagenUrl: { type: String, required: true },
  imagenMobileUrl: { type: String, default: '' },
  imagenPublicId: { type: String, default: '' },
  imagenMobilePublicId: { type: String, default: '' },
  administrado: { type: Boolean, default: false },
  titulo: { type: String, default: '', maxlength: 100 },
  subtitulo: { type: String, default: '', maxlength: 240 },
  textoBoton: { type: String, default: '', maxlength: 40 },
  enlace: { type: String, default: '/tienda', maxlength: 300 },
  alineacion: { type: String, enum: ['Centro', 'Izquierda', 'Derecha', 'Abajo'], default: 'Centro' },
  escritorioX: { type: Number, default: 50, min: 0, max: 100 },
  escritorioY: { type: Number, default: 50, min: 0, max: 100 },
  escritorioZoom: { type: Number, default: 120, min: 100, max: 200 },
  celularX: { type: Number, default: 50, min: 0, max: 100 },
  celularY: { type: Number, default: 50, min: 0, max: 100 },
  celularZoom: { type: Number, default: 120, min: 100, max: 200 },
  dispositivo: { type: String, enum: ['ESCRITORIO', 'CELULAR'], required: true },
  posicion: { type: Number, default: 0 },
  posicionImagen: { type: String, default: 'center' },
  empiezaEn: { type: Date },
  terminaEn: { type: Date },
  activo: { type: Boolean, default: true },
  archivado: { type: Boolean, default: false }
}, { timestamps: true, autoIndex: false, autoCreate: false });
schema.index({ dispositivo: 1, activo: 1, posicion: 1 });
module.exports = model('Banner', schema);
