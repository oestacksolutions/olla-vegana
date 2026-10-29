const { Schema, model } = require('mongoose');
module.exports = model('Atributo', new Schema({
  nombre: { type: String, required: true, unique: true }
}, { timestamps: true }));
