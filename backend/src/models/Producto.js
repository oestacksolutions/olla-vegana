const { Schema, model } = require('mongoose');
module.exports = model('Producto', new Schema({
  nombre: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  descripcion: { type: String, required: true },
  precioBase: { type: Number, required: true },
  activo: { type: Boolean, default: true },
  destacado: { type: Boolean, default: false },
  categoriaId: { type: Schema.Types.ObjectId, ref: 'Categoria', required: true }
}, { timestamps: true }));
