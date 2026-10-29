const { Schema, model } = require('mongoose');
const schema = new Schema({
  correo: { type: String, required: true, unique: true },
  contrasena: { type: String, required: true, select: false },
  activo: { type: Boolean, default: true },
  resetPasswordToken: { type: String, select: false },
  resetPasswordExpires: { type: Date, select: false }
}, { timestamps: true });
module.exports = model('Admin', schema);
