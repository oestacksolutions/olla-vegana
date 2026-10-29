const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createPickupService, isSelectable } = require('../src/services/pickupService');

test('ofrece disponibilidad computada y no selecciona puntos sin dirección o autorización explícita', async () => {
  let pointFilter;
  const service = createPickupService({
    PuntoRetiro: { find: async (filter) => {
      pointFilter = filter;
      return [
        { _id: 'moron', nombre: 'Morón', direccion: null, activo: true, habilitadoCheckout: false, horariosHabituales: [{ diaSemana: 'MARTES', horaInicio: '16:00', horaFin: '19:00' }] },
        { _id: 'listo', nombre: 'Punto habilitado', direccion: 'Dirección confirmada', activo: true, habilitadoCheckout: true, horariosHabituales: [{ diaSemana: 'LUNES', horaInicio: '10:00', horaFin: '12:00' }] }
      ];
    } },
    RetiroEspecial: { find: async () => [] }
  });
  const result = await service.listOptions();
  assert.deepEqual(pointFilter, { activo: true });
  assert.equal(result.puntosRetiro[0].disponibleParaSeleccionar, false);
  assert.equal(result.puntosRetiro[1].disponibleParaSeleccionar, true);
  assert.deepEqual(result.puntosRetiro[0].diasHabituales, ['MARTES']);
  assert.deepEqual(result.retirosEspeciales, []);
  assert.equal(isSelectable({ activo: true, habilitadoCheckout: true, direccion: ' ', horariosHabituales: [{ diaSemana: 'LUNES' }] }), false);
});

test('solo devuelve fechas especiales concretas, futuras y habilitadas', async () => {
  const now = new Date('2027-05-01T12:00:00Z');
  let query;
  const service = createPickupService({
    PuntoRetiro: { find: async () => [] },
    RetiroEspecial: { find: async (filter) => {
      query = filter;
      return [{ _id: 'special-1', evento: 'VEGANPALUJA', fecha: new Date('2027-05-16T00:00:00Z'), lugar: 'Lugar confirmado', direccion: null, horaInicio: '10:00', horaFin: '12:00', activo: true, habilitadoCheckout: true }];
    } }
  }, { ahora: () => now });
  const result = await service.listOptions();
  assert.equal(query.activo, true);
  assert.equal(query.habilitadoCheckout, true);
  assert.deepEqual(query.fecha, { $gt: now });
  assert.equal(result.retirosEspeciales[0].disponibleParaSeleccionar, true);
  assert.equal(result.retirosEspeciales[0].lugar, 'Lugar confirmado');
});

test('mantiene disponible un punto legado con horario de texto válido y devuelve el texto intacto', async () => {
  const legacyHours = 'Martes y viernes de 16:00 a 19:00';
  const service = createPickupService({
    PuntoRetiro: { find: async () => [{
      _id: 'legacy-1', nombre: 'Punto existente', direccion: 'Dirección existente',
      horarios: legacyHours, activo: true
      // habilitadoCheckout falta en documentos creados antes de agregar ese campo.
    }] },
    RetiroEspecial: { find: async () => [] }
  });
  const result = await service.listOptions();
  assert.equal(result.puntosRetiro[0].horarios, legacyHours);
  assert.deepEqual(result.puntosRetiro[0].horariosHabituales, []);
  assert.equal(result.puntosRetiro[0].disponibleParaSeleccionar, true);
  assert.equal(isSelectable({ activo: true, habilitadoCheckout: false, direccion: 'Dirección existente', horarios: legacyHours }), false);
});
