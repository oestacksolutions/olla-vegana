const { Schema, model } = require('mongoose');
const schema = new Schema({
  nombre: { type: String, required: true, unique: true }
}, { timestamps: true });
module.exports = model('Atributo', schema);
