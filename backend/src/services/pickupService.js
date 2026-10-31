function query(value, { sort, session } = {}) {
  if (sort && value && typeof value.sort === 'function') value = value.sort(sort);
  if (session && value && typeof value.session === 'function') value = value.session(session);
  if (value && typeof value.lean === 'function') value = value.lean();
  return value;
}

const days = new Set(['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO']);
const validTime = (value) => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const minutes = (value) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
const TIME_ZONE = 'America/Argentina/Buenos_Aires';

function hasOverlappingSchedules(schedules, keyOf) {
  const grouped = new Map();
  for (const schedule of schedules) {
    const key = keyOf(schedule);
    const group = grouped.get(key) || [];
    group.push(schedule);
    grouped.set(key, group);
  }
  return [...grouped.values()].some((group) => {
    group.sort((left, right) => minutes(left.horaInicio) - minutes(right.horaInicio));
    return group.some((item, index) => index > 0 && minutes(item.horaInicio) < minutes(group[index - 1].horaFin));
  });
}

function localDateString(value) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date(value));
  const mapped = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return `${mapped.year}-${mapped.month}-${mapped.day}`;
}

function localTimeString(value) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value));
}

function isUpcomingSchedule(schedule, today, now) {
  if (!schedule?.fecha || !validTime(schedule.horaFin)) return false;
  const date = localDateString(schedule.fecha);
  return date > today || (date === today && schedule.horaFin > localTimeString(now));
}

function isSelectable(point) {
  const schedules = point.horariosHabituales || [];
  const hasLegacySchedule = typeof point.horarios === 'string' && point.horarios.trim().length > 0;
  const hasValidSchedule = schedules.length > 0 && schedules.every((schedule) =>
    days.has(schedule.diaSemana) && validTime(schedule.horaInicio) && validTime(schedule.horaFin) && minutes(schedule.horaFin) > minutes(schedule.horaInicio)
  ) && !hasOverlappingSchedules(schedules, (schedule) => schedule.diaSemana);
  const isLegacyRecord = point.habilitadoCheckout == null && hasLegacySchedule;
  return Boolean(
    point.activo && (point.habilitadoCheckout === true || isLegacyRecord) &&
    typeof point.direccion === 'string' && point.direccion.trim() &&
    (hasValidSchedule || isLegacyRecord)
  );
}

function isSpecialSelectable(pickup, now) {
  const today = localDateString(now);
  const eventEnd = localDateString(pickup.fechaFin || pickup.fechaInicio || pickup.fecha);
  const eventStart = localDateString(pickup.fechaInicio || pickup.fecha);
  const selectionStart = pickup.seleccionDesde ? localDateString(pickup.seleccionDesde) : today;
  const selectionEnd = pickup.seleccionHasta ? localDateString(pickup.seleccionHasta) : eventEnd;
  const schedules = pickup.horariosRetiro?.length ? pickup.horariosRetiro : [{ fecha: pickup.fecha, horaInicio: pickup.horaInicio, horaFin: pickup.horaFin }];
  const validSchedules = schedules.length > 0 && schedules.every((schedule) => schedule.fecha && validTime(schedule.horaInicio) &&
    validTime(schedule.horaFin) && minutes(schedule.horaFin) > minutes(schedule.horaInicio) &&
    localDateString(schedule.fecha) >= eventStart && localDateString(schedule.fecha) <= eventEnd) &&
    !hasOverlappingSchedules(schedules, (schedule) => localDateString(schedule.fecha));
  const upcomingSchedules = schedules.filter((schedule) => isUpcomingSchedule(schedule, today, now));
  return Boolean(pickup.activo && pickup.habilitadoCheckout && today <= eventEnd && today >= selectionStart && today <= selectionEnd &&
    pickup.lugar?.trim() && pickup.direccion?.trim() && validSchedules && upcomingSchedules.length > 0);
}

function createPickupService({ PuntoRetiro, RetiroEspecial }, { ahora = () => new Date() } = {}) {
  async function listOptions({ session } = {}) {
    const now = ahora();
    let points;
    let specialPickups;
    const pointsQuery = PuntoRetiro.find({ activo: true });
    const specialQuery = RetiroEspecial.find({ activo: true, habilitadoCheckout: true });
    if (session) {
      points = await query(pointsQuery, { sort: { nombre: 1 }, session });
      specialPickups = await query(specialQuery, { sort: { fecha: 1 }, session });
    } else {
      [points, specialPickups] = await Promise.all([
        query(pointsQuery, { sort: { nombre: 1 } }),
        query(specialQuery, { sort: { fecha: 1 } })
      ]);
    }

    return {
      puntosRetiro: points.map((point) => ({
        id: String(point._id), nombre: point.nombre, direccion: point.direccion || null,
        horarios: point.horarios || null,
        indicaciones: point.indicaciones || '',
        zonaHoraria: point.zonaHoraria || TIME_ZONE,
        diasHabituales: [...new Set((point.horariosHabituales || []).map((schedule) => schedule.diaSemana))],
        horariosHabituales: (point.horariosHabituales || []).map((schedule) => ({ ...(schedule.toObject?.() || schedule) })),
        activo: point.activo, disponibleParaSeleccionar: isSelectable(point)
      })),
      retirosEspeciales: specialPickups.filter((pickup) => isSpecialSelectable(pickup, now)).map((pickup) => ({
        id: String(pickup._id), evento: pickup.evento, nombre: pickup.nombre || 'Veganpaluja', fecha: pickup.fecha,
        fechaInicio: pickup.fechaInicio || pickup.fecha, fechaFin: pickup.fechaFin || pickup.fecha,
        horariosRetiro: (pickup.horariosRetiro?.length ? pickup.horariosRetiro : [{ fecha: pickup.fecha, horaInicio: pickup.horaInicio, horaFin: pickup.horaFin }])
          .filter((schedule) => isUpcomingSchedule(schedule, localDateString(now), now))
          .map((schedule) => ({ fecha: schedule.fecha, horaInicio: schedule.horaInicio, horaFin: schedule.horaFin })),
        lugar: pickup.lugar, direccion: pickup.direccion || null,
        horaInicio: pickup.horaInicio, horaFin: pickup.horaFin,
        indicaciones: pickup.indicaciones || '', zonaHoraria: pickup.zonaHoraria || TIME_ZONE,
        activo: pickup.activo, disponibleParaSeleccionar: true
      }))
    };
  }

  return { listOptions };
}

module.exports = { createPickupService, isSelectable, isSpecialSelectable, localDateString, localTimeString, hasOverlappingSchedules };
