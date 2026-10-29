const { Schema, model } = require('mongoose');
const schema = new Schema({
  varianteId: { type: Schema.Types.ObjectId, ref: 'Variante', required: true },
  valorAtributoId: { type: Schema.Types.ObjectId, ref: 'ValorAtributo', required: true }
}, { timestamps: true });
schema.index({ varianteId: 1, valorAtributoId: 1 }, { unique: true });
module.exports = model('ValorVariante', schema);
