const { Schema, model } = require('mongoose');
module.exports = model('PuntoRetiro', new Schema({
  nombre: { type: String, required: true, unique: true },
  direccion: { type: String, required: true },
  horarios: { type: String, required: true },
  activo: { type: Boolean, default: true }
}, { timestamps: true }));
