const { Schema, model } = require('mongoose');
module.exports = model('Categoria', new Schema({
  nombre: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  descripcion: { type: String },
  activa: { type: Boolean, default: true },
  padreId: { type: Schema.Types.ObjectId, ref: 'Categoria', default: null }
}, { timestamps: true }));
