const { Schema, model } = require('mongoose');
module.exports = model('Configuracion', new Schema({
  _id: { type: String, required: true },
  valor: { type: String, required: true }
}, { timestamps: { updatedAt: 'actualizadoEn', createdAt: false } }));
