const { Schema, model } = require('mongoose');

const horaValida = (hora) => typeof hora === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(hora);
const minutos = (hora) => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3));
const TZ = 'America/Argentina/Buenos_Aires';

const horarioEventoSchema = new Schema({
  fecha: { type: Date, required: true },
  horaInicio: { type: String, required: true, validate: horaValida },
  horaFin: { type: String, required: true, validate: {
    validator(value) { return horaValida(value) && horaValida(this.horaInicio) && minutos(value) > minutos(this.horaInicio); },
    message: 'La hora de cierre debe ser posterior a la hora de apertura.'
  } }
}, { _id: false });

const schema = new Schema({
  evento: { type: String, enum: ['VEGANPALUJA'], required: true },
  nombre: { type: String, default: 'Veganpaluja', trim: true, maxlength: 120 },
  fecha: { type: Date, required: true },
  fechaInicio: { type: Date, default: null },
  fechaFin: { type: Date, default: null },
  seleccionDesde: { type: Date, default: null },
  seleccionHasta: { type: Date, default: null },
  lugar: { type: String, required: true, trim: true },
  direccion: { type: String, default: null, trim: true },
  indicaciones: { type: String, default: '', maxlength: 1000 },
  zonaHoraria: { type: String, default: TZ, enum: [TZ] },
  horariosRetiro: { type: [horarioEventoSchema], default: [] },
  horaInicio: { type: String, required: true, validate: horaValida },
  horaFin: {
    type: String,
    required: true,
    validate: {
      validator(value) {
        return horaValida(value) && horaValida(this.horaInicio) && minutos(value) > minutos(this.horaInicio);
      },
      message: 'La hora de cierre debe ser posterior a la hora de apertura.'
    }
  },
  activo: { type: Boolean, default: false },
  habilitadoCheckout: { type: Boolean, default: false }
}, { timestamps: true, optimisticConcurrency: true });

schema.index({ activo: 1, habilitadoCheckout: 1, fecha: 1 });
module.exports = model('RetiroEspecial', schema);
