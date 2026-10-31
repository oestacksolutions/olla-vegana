const mongoose = require('mongoose');
const AppError = require('../utils/AppError');
const { isSelectable, isSpecialSelectable } = require('./pickupService');

const TIME_ZONE = 'America/Argentina/Buenos_Aires';
const DAYS = new Set(['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO']);
const TERMINAL_ORDER_STATES = ['RETIRADO', 'CANCELADO'];
const isTime = (value) => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const toMinutes = (value) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));

function invalid(message) { throw AppError.solicitudInvalida(message); }
function conflict(message) { throw AppError.conflicto(message); }

function localDate(value, field) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) invalid(`${field} debe ser una fecha válida`);
  const parsed = new Date(`${value}T00:00:00-03:00`);
  if (Number.isNaN(parsed.getTime()) || dateString(parsed) !== value) invalid(`${field} debe ser una fecha válida`);
  return parsed;
}

function dateString(value) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date(value));
  const values = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return `${values.year}-${values.month}-${values.day}`;
}

function cleanText(value, field, { required = false, max = 240 } = {}) {
  if (typeof value !== 'string') invalid(`${field} debe ser texto`);
  const cleaned = value.trim();
  if ((required && !cleaned) || cleaned.length > max) invalid(`${field} es obligatorio y debe tener hasta ${max} caracteres`);
  return cleaned;
}

function validateIntervals(schedules, { event = false, startDate, endDate } = {}) {
  if (!Array.isArray(schedules) || schedules.length > 56) invalid('La lista de horarios no es válida');
  const normalized = schedules.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) invalid('Hay un horario inválido');
    if (!isTime(entry.horaInicio) || !isTime(entry.horaFin) || toMinutes(entry.horaFin) <= toMinutes(entry.horaInicio)) invalid('Cada horario debe tener inicio y fin válidos');
    if (event) {
      const fecha = localDate(entry.fecha, 'La fecha del horario');
      const day = dateString(fecha);
      if (startDate && day < dateString(startDate)) invalid('El horario no puede ser anterior al evento');
      if (endDate && day > dateString(endDate)) invalid('El horario no puede ser posterior al evento');
      return { fecha, fechaKey: day, horaInicio: entry.horaInicio, horaFin: entry.horaFin };
    }
    if (!DAYS.has(entry.diaSemana)) invalid('Seleccioná un día de atención válido');
    return { diaSemana: entry.diaSemana, horaInicio: entry.horaInicio, horaFin: entry.horaFin };
  });
  const grouped = new Map();
  for (const schedule of normalized) {
    const key = event ? schedule.fechaKey : schedule.diaSemana;
    const rows = grouped.get(key) || [];
    rows.push(schedule);
    grouped.set(key, rows);
  }
  for (const rows of grouped.values()) {
    rows.sort((left, right) => toMinutes(left.horaInicio) - toMinutes(right.horaInicio));
    for (let index = 1; index < rows.length; index += 1) {
      if (toMinutes(rows[index].horaInicio) < toMinutes(rows[index - 1].horaFin)) invalid('Los horarios de un mismo día no pueden superponerse');
    }
  }
  return normalized.map(({ fechaKey, ...entry }) => entry);
}

function mapPoint(point, pendingOrders = 0) {
  return {
    id: String(point._id), version: point.__v || 0, tipo: 'HABITUAL', nombre: point.nombre,
    direccion: point.direccion || '', indicaciones: point.indicaciones || '',
    horarios: point.horarios || '', horariosHabituales: (point.horariosHabituales || []).map((entry) => ({ ...entry })),
    activo: Boolean(point.activo), habilitadoCheckout: Boolean(point.habilitadoCheckout),
    disponibleParaSeleccionar: isSelectable(point), pedidosPendientes: pendingOrders, zonaHoraria: TIME_ZONE
  };
}

function mapEvent(event, pendingOrders = 0) {
  const start = event.fechaInicio || event.fecha;
  const end = event.fechaFin || event.fechaInicio || event.fecha;
  const schedules = (event.horariosRetiro?.length ? event.horariosRetiro : [{ fecha: event.fecha, horaInicio: event.horaInicio, horaFin: event.horaFin }])
    .map((entry) => ({ fecha: dateString(entry.fecha), horaInicio: entry.horaInicio, horaFin: entry.horaFin }));
  return {
    id: String(event._id), version: event.__v || 0, tipo: 'EVENTO', evento: event.evento,
    nombre: event.nombre || 'Veganpaluja', lugar: event.lugar, direccion: event.direccion || '',
    indicaciones: event.indicaciones || '', fechaInicio: dateString(start), fechaFin: dateString(end),
    seleccionDesde: event.seleccionDesde ? dateString(event.seleccionDesde) : '',
    seleccionHasta: event.seleccionHasta ? dateString(event.seleccionHasta) : '',
    horariosRetiro: schedules, activo: Boolean(event.activo), habilitadoCheckout: Boolean(event.habilitadoCheckout),
    disponibleParaSeleccionar: isSpecialSelectable(event, new Date()), pedidosPendientes: pendingOrders, zonaHoraria: TIME_ZONE
  };
}

function createAdminPickupService({ PuntoRetiro, RetiroEspecial, Pedido }) {
  async function pendingCount(field, id) {
    if (!Pedido || !Pedido.countDocuments) return 0;
    return Pedido.countDocuments({ [field]: id, estado: { $nin: TERMINAL_ORDER_STATES } });
  }

  async function list() {
    const [points, events] = await Promise.all([
      PuntoRetiro.find({}).sort({ nombre: 1 }).lean(), RetiroEspecial.find({}).sort({ fechaInicio: 1, fecha: 1 }).lean()
    ]);
    const [mappedPoints, mappedEvents] = await Promise.all([
      Promise.all(points.map(async (point) => mapPoint(point, await pendingCount('puntoRetiroId', point._id)))),
      Promise.all(events.map(async (event) => mapEvent(event, await pendingCount('retiroEspecialId', event._id))))
    ]);
    return { zonaHoraria: TIME_ZONE, puntos: mappedPoints, eventos: mappedEvents };
  }

  async function getPoint(id) {
    if (!mongoose.isValidObjectId(id)) throw AppError.solicitudInvalida('El identificador del punto no es válido');
    const point = await PuntoRetiro.findById(id).lean();
    if (!point) throw AppError.noEncontrado('Punto de retiro no encontrado');
    return mapPoint(point, await pendingCount('puntoRetiroId', point._id));
  }

  async function getEvent(id) {
    if (!mongoose.isValidObjectId(id)) throw AppError.solicitudInvalida('El identificador del evento no es válido');
    const event = await RetiroEspecial.findById(id).lean();
    if (!event) throw AppError.noEncontrado('Evento de retiro no encontrado');
    return mapEvent(event, await pendingCount('retiroEspecialId', event._id));
  }

  function normalizePoint(input) {
    const allowed = new Set(['nombre', 'direccion', 'indicaciones', 'horarios', 'horariosHabituales', 'activo', 'habilitadoCheckout']);
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some((key) => !allowed.has(key))) invalid('Los datos del punto no son válidos');
    if (typeof input.activo !== 'boolean' || typeof input.habilitadoCheckout !== 'boolean') invalid('Indicá si el punto está activo y disponible para el checkout');
    const nombre = cleanText(input.nombre, 'El nombre', { required: true, max: 100 });
    const direccion = cleanText(input.direccion, 'La dirección', { required: true, max: 300 });
    const indicaciones = cleanText(input.indicaciones ?? '', 'Las indicaciones', { max: 1000 });
    const schedules = validateIntervals(input.horariosHabituales);
    if (input.habilitadoCheckout && (!input.activo || !schedules.length)) invalid('Para habilitar el checkout, activá el punto y configurá al menos un horario válido');
    const days = [...new Set(schedules.map((schedule) => schedule.diaSemana))];
    const legacy = schedules.map((schedule) => `${schedule.diaSemana}: ${schedule.horaInicio}–${schedule.horaFin}`).join('; ')
      || (typeof input.horarios === 'string' ? cleanText(input.horarios, 'Los horarios heredados', { max: 500 }) : '');
    return { nombre, direccion, indicaciones, horariosHabituales: schedules, horarios: legacy || null,
      activo: input.activo, habilitadoCheckout: input.habilitadoCheckout, zonaHoraria: TIME_ZONE, diasHabituales: days };
  }

  function normalizeEvent(input) {
    const allowed = new Set(['evento', 'nombre', 'lugar', 'direccion', 'indicaciones', 'fechaInicio', 'fechaFin', 'seleccionDesde', 'seleccionHasta', 'horariosRetiro', 'activo', 'habilitadoCheckout']);
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some((key) => !allowed.has(key))) invalid('Los datos del evento no son válidos');
    if (input.evento !== 'VEGANPALUJA' || typeof input.activo !== 'boolean' || typeof input.habilitadoCheckout !== 'boolean') invalid('El tipo o estado del evento no es válido');
    const nombre = cleanText(input.nombre, 'El nombre del evento', { required: true, max: 120 });
    const lugar = cleanText(input.lugar, 'La ubicación del evento', { required: true, max: 200 });
    const direccion = cleanText(input.direccion, 'La dirección', { required: true, max: 300 });
    const indicaciones = cleanText(input.indicaciones ?? '', 'Las indicaciones', { max: 1000 });
    const fechaInicio = localDate(input.fechaInicio, 'La fecha de inicio');
    const fechaFin = localDate(input.fechaFin || input.fechaInicio, 'La fecha de fin');
    if (dateString(fechaFin) < dateString(fechaInicio)) invalid('La fecha de fin del evento no puede ser anterior a la fecha de inicio');
    const seleccionDesde = input.seleccionDesde ? localDate(input.seleccionDesde, 'El inicio de selección') : null;
    const seleccionHasta = input.seleccionHasta ? localDate(input.seleccionHasta, 'El fin de selección') : null;
    if (seleccionDesde && seleccionHasta && dateString(seleccionHasta) < dateString(seleccionDesde)) invalid('El fin de selección no puede ser anterior al inicio');
    if ((seleccionDesde && dateString(seleccionDesde) > dateString(fechaFin)) || (seleccionHasta && dateString(seleccionHasta) < dateString(fechaInicio))) {
      invalid('El período de selección debe coincidir con el período del evento');
    }
    const schedules = validateIntervals(input.horariosRetiro, { event: true, startDate: fechaInicio, endDate: fechaFin });
    if (input.habilitadoCheckout && (!input.activo || !schedules.length || !seleccionDesde || !seleccionHasta)) {
      invalid('Para habilitar el checkout, activá el evento y configurá fechas de selección y horarios');
    }
    const first = schedules[0];
    return { evento: input.evento, nombre, fecha: first?.fecha || fechaInicio, fechaInicio, fechaFin,
      seleccionDesde, seleccionHasta, lugar, direccion, indicaciones, horariosRetiro: schedules,
      horaInicio: first?.horaInicio || '09:00', horaFin: first?.horaFin || '10:00', activo: input.activo,
      habilitadoCheckout: input.habilitadoCheckout, zonaHoraria: TIME_ZONE };
  }

  async function createPoint(input) {
    try { const point = await PuntoRetiro.create(normalizePoint(input)); return mapPoint(point); }
    catch (error) { if (error?.code === 11000) conflict('Ya existe un punto de retiro con ese nombre'); throw error; }
  }

  async function createEvent(input) {
    return mapEvent(await RetiroEspecial.create(normalizeEvent(input)));
  }

  async function update(model, id, input, normalizer, label) {
    if (!mongoose.isValidObjectId(id)) throw AppError.solicitudInvalida('El identificador no es válido');
    if (!input || !Number.isSafeInteger(input.version) || input.version < 0) invalid('La versión del registro es obligatoria para evitar sobrescribir cambios');
    const { version, ...changes } = input;
    const normalized = normalizer(changes);
    try {
      if (model === PuntoRetiro && await PuntoRetiro.findOne({ nombre: normalized.nombre, _id: { $ne: id } }).select('_id').lean()) {
        conflict('Ya existe otro punto de retiro con ese nombre');
      }
      const versionFilter = version === 0 ? { $or: [{ __v: 0 }, { __v: { $exists: false } }] } : { __v: version };
      const result = await model.findOneAndUpdate({ _id: id, ...versionFilter }, { $set: normalized, $inc: { __v: 1 } }, { new: true, runValidators: true }).lean();
      if (result) return model === PuntoRetiro ? mapPoint(result, await pendingCount('puntoRetiroId', result._id)) : mapEvent(result, await pendingCount('retiroEspecialId', result._id));
      const exists = await model.exists({ _id: id });
      if (!exists) throw AppError.noEncontrado(`${label} no encontrado`);
      conflict('Otra administradora modificó este registro. Actualizá los datos antes de volver a guardar.');
    } catch (error) {
      if (error?.code === 11000) conflict('Ya existe otro punto de retiro con ese nombre');
      throw error;
    }
  }

  return {
    list, getPoint, getEvent, createPoint, createEvent,
    updatePoint: (id, input) => update(PuntoRetiro, id, input, normalizePoint, 'Punto de retiro'),
    updateEvent: (id, input) => update(RetiroEspecial, id, input, normalizeEvent, 'Evento')
  };
}

module.exports = { createAdminPickupService, validateIntervals, dateString, localDate, TIME_ZONE };
