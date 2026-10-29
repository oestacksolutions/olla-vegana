const { Schema, model } = require('mongoose');

const schema = new Schema({
  url: { type: String, required: true, trim: true },
  posicion: { type: Number, default: 0, validate: Number.isInteger },
  productoId: { type: Schema.Types.ObjectId, ref: 'Producto', required: true },
  varianteId: { type: Schema.Types.ObjectId, ref: 'Variante', default: null }
}, { timestamps: { createdAt: 'creadoEn', updatedAt: 'actualizadoEn' } });

schema.index({ productoId: 1, posicion: 1 });
schema.index({ varianteId: 1 });
module.exports = model('ImagenProducto', schema);
