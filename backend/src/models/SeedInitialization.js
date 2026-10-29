const { Schema, model } = require('mongoose');

const schema = new Schema({
  _id: { type: String, required: true },
  estado: { type: String, enum: ['inicializando', 'completado', 'bloqueado', 'fallido'], required: true },
  propietario: { type: String, required: true },
  iniciadoEn: { type: Date, required: true },
  completadoEn: { type: Date, default: null }
}, { versionKey: false, collection: 'seedinitializations' });

module.exports = model('SeedInitialization', schema);
