const { Schema, model } = require('mongoose');
const schema = new Schema({
  nombre: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  descripcion: { type: String, required: true },
  precioBase: { type: Schema.Types.Decimal128, required: true, min: 0 },
  activo: { type: Boolean, default: true },
  destacado: { type: Boolean, default: false },
  categoriaId: { type: Schema.Types.ObjectId, ref: 'Categoria', required: true }
}, { timestamps: true });
schema.index({ categoriaId: 1, activo: 1 });
module.exports = model('Producto', schema);
