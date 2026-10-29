const { Schema, model } = require('mongoose');
const schema = new Schema({
  valor: { type: String, required: true },
  atributoId: { type: Schema.Types.ObjectId, ref: 'Atributo', required: true }
}, { timestamps: true });
schema.index({ atributoId: 1, valor: 1 }, { unique: true });
module.exports = model('ValorAtributo', schema);
