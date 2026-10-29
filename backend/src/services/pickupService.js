function query(value, { sort } = {}) {
  if (sort && value && typeof value.sort === 'function') value = value.sort(sort);
  if (value && typeof value.lean === 'function') value = value.lean();
  return value;
}

const days = new Set(['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO']);
const validTime = (value) => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const minutes = (value) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));

function isSelectable(point) {
  const schedules = point.horariosHabituales || [];
  const hasLegacySchedule = typeof point.horarios === 'string' && point.horarios.trim().length > 0;
  const hasValidSchedule = schedules.length > 0 && schedules.every((schedule) =>
    days.has(schedule.diaSemana) && validTime(schedule.horaInicio) && validTime(schedule.horaFin) && minutes(schedule.horaFin) > minutes(schedule.horaInicio)
  );
  const isLegacyRecord = point.habilitadoCheckout == null && hasLegacySchedule;
  return Boolean(
    point.activo && (point.habilitadoCheckout === true || isLegacyRecord) &&
    typeof point.direccion === 'string' && point.direccion.trim() &&
    (hasValidSchedule || isLegacyRecord)
  );
}

function isSpecialSelectable(pickup, now) {
  return Boolean(pickup.activo && pickup.habilitadoCheckout && pickup.fecha > now && pickup.lugar?.trim() &&
    validTime(pickup.horaInicio) && validTime(pickup.horaFin) && minutes(pickup.horaFin) > minutes(pickup.horaInicio));
}

function createPickupService({ PuntoRetiro, RetiroEspecial }, { ahora = () => new Date() } = {}) {
  async function listOptions() {
    const now = ahora();
    const [points, specialPickups] = await Promise.all([
      query(PuntoRetiro.find({ activo: true }), { sort: { nombre: 1 } }),
      query(RetiroEspecial.find({ activo: true, habilitadoCheckout: true, fecha: { $gt: now } }), { sort: { fecha: 1 } })
    ]);

    return {
      puntosRetiro: points.map((point) => ({
        id: String(point._id), nombre: point.nombre, direccion: point.direccion || null,
        horarios: point.horarios || null,
        diasHabituales: [...new Set((point.horariosHabituales || []).map((schedule) => schedule.diaSemana))],
        horariosHabituales: (point.horariosHabituales || []).map((schedule) => ({ ...(schedule.toObject?.() || schedule) })),
        activo: point.activo, disponibleParaSeleccionar: isSelectable(point)
      })),
      retirosEspeciales: specialPickups.filter((pickup) => isSpecialSelectable(pickup, now)).map((pickup) => ({
        id: String(pickup._id), evento: pickup.evento, fecha: pickup.fecha,
        lugar: pickup.lugar, direccion: pickup.direccion || null,
        horaInicio: pickup.horaInicio, horaFin: pickup.horaFin,
        activo: pickup.activo, disponibleParaSeleccionar: true
      }))
    };
  }

  return { listOptions };
}

module.exports = { createPickupService, isSelectable, isSpecialSelectable };
