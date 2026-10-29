const { Schema, model } = require('mongoose');

const schema = new Schema({
  url: { type: String, default: null, trim: true },
  posicion: { type: Number, default: 0, validate: Number.isInteger },
  productoId: { type: Schema.Types.ObjectId, ref: 'Producto', required: true },
  varianteId: { type: Schema.Types.ObjectId, ref: 'Variante', default: null },
  publicId: { type: String, default: null },
  publicIdPendienteEliminar: { type: String, default: null, select: false },
  urlPendienteRevision: { type: String, default: null, select: false },
  textoAlternativo: { type: String, default: '', trim: true, maxlength: 300 },
  esPrincipal: { type: Boolean, default: false },
  estadoAlmacenamiento: {
    type: String,
    enum: ['PENDIENTE', 'ACTIVA', 'PENDIENTE_LIMPIEZA'],
    default: 'ACTIVA'
  },
  tipoContenido: { type: String, default: null },
  bytes: { type: Number, default: null, min: 0 }
}, { timestamps: { createdAt: 'creadoEn', updatedAt: 'actualizadoEn' }, autoIndex: false });

schema.index({ productoId: 1, posicion: 1 });
schema.index({ varianteId: 1 });
schema.index(
  { productoId: 1, esPrincipal: 1 },
  {
    unique: true,
    name: 'uniq_imagen_producto_principal',
    partialFilterExpression: { esPrincipal: true }
  }
);
module.exports = model('ImagenProducto', schema);
