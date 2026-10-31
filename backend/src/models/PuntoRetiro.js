const { Schema, model } = require('mongoose');

const dias = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'];
const horaValida = (hora) => typeof hora === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(hora);
const minutos = (hora) => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3));

const horarioSchema = new Schema({
  diaSemana: { type: String, enum: dias, required: true },
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
  }
}, { _id: false });

const TZ = 'America/Argentina/Buenos_Aires';

const schema = new Schema({
  nombre: { type: String, required: true, unique: true },
  direccion: { type: String, default: null },
  indicaciones: { type: String, default: '', maxlength: 1000 },
  zonaHoraria: { type: String, default: TZ, enum: [TZ] },
  // Compatibilidad de lectura/escritura para documentos preexistentes con horario en texto.
  horarios: { type: String, default: null },
  horariosHabituales: { type: [horarioSchema], default: [] },
  activo: { type: Boolean, default: true },
  habilitadoCheckout: { type: Boolean, default: false }
}, { timestamps: true, optimisticConcurrency: true });

schema.index({ activo: 1, habilitadoCheckout: 1, nombre: 1 });
module.exports = model('PuntoRetiro', schema);
