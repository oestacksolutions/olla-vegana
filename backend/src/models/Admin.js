const { Schema, model } = require('mongoose');
module.exports = model('Admin', new Schema({
  correo: { type: String, required: true, unique: true },
  contrasena: { type: String, required: true },
  activo: { type: Boolean, default: true }
}, { timestamps: true }));
