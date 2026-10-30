const crypto = require('node:crypto');
const mongoose = require('mongoose');
const AppError = require('../utils/AppError');
const { parseMoneyToCents, formatCents } = require('./cartValidationService');

function execute(query) {
  return query && typeof query.exec === 'function' ? query.exec() : Promise.resolve(query);
}

function withSession(query, session) {
  return session && query && typeof query.session === 'function' ? query.session(session) : query;
}

function isDuplicate(error) {
  return error?.code === 11000;
}

function normalizeInput({ pedidoId, adminId, referencia, importeAcreditado, idOperacion }) {
  if (!mongoose.isObjectIdOrHexString(pedidoId)) throw AppError.solicitudInvalida('El identificador del pedido no es válido');
  if (!mongoose.isObjectIdOrHexString(adminId)) throw AppError.prohibido('Se requiere una sesión administrativa válida');
  if (typeof referencia !== 'string' || referencia.trim().length < 3 || referencia.trim().length > 120) {
    throw AppError.solicitudInvalida('La referencia de transferencia es obligatoria y debe tener entre 3 y 120 caracteres');
  }
  if (typeof importeAcreditado !== 'string' || !/^\d{1,12}(?:\.\d{1,2})?$/.test(importeAcreditado.trim())) {
    throw AppError.solicitudInvalida('El importe acreditado debe ser un monto decimal con hasta dos centavos');
  }
  const amountCents = parseMoneyToCents(importeAcreditado.trim());
  if (amountCents === null || amountCents < 0n) throw AppError.solicitudInvalida('El importe acreditado debe ser un monto válido');
  if (typeof idOperacion !== 'string' || idOperacion.length < 8 || idOperacion.length > 128 || !/^[\w.:/-]+$/.test(idOperacion)) {
    throw AppError.solicitudInvalida('Falta una clave Idempotency-Key válida');
  }
  const cleanReference = referencia.trim();
  const canonical = JSON.stringify({ pedidoId: String(pedidoId), referencia: cleanReference, importeAcreditado: formatCents(amountCents) });
  return {
    pedidoId,
    adminId,
    referencia: cleanReference,
    importeAcreditado: formatCents(amountCents),
    importeAcreditadoCentavos: amountCents,
    idOperacion,
    huellaSolicitud: crypto.createHash('sha256').update(canonical).digest('hex')
  };
}

function createTransferPaymentService(models, {
  stockReservationService,
  transferPaymentAuthorization,
  startSession = () => models.Pedido.db.startSession(),
  ahora = () => new Date()
} = {}) {
  const { Pedido, ReservaStock, ConfirmacionTransferencia } = models;
  if (!stockReservationService || !transferPaymentAuthorization || !ConfirmacionTransferencia) {
    throw new TypeError('El servicio de transferencia requiere autorización, confirmación y reservas CAR-06');
  }

  async function assertIndexes() {
    try {
      const indexes = await ConfirmacionTransferencia.collection.indexes();
      const operationIndex = indexes.find((index) => index.name === 'uniq_confirmacion_transferencia_operacion');
      const referenceIndex = indexes.find((index) => index.name === 'uniq_confirmacion_transferencia_referencia');
      if (!operationIndex?.unique || !referenceIndex?.unique) throw new Error('missing transfer indexes');
    } catch {
      throw new AppError('La confirmación de transferencias está deshabilitada hasta verificar sus índices', 503);
    }
  }

  async function findPrior(input) {
    let query = ConfirmacionTransferencia.findOne({ idOperacion: input.idOperacion });
    if (query && typeof query.select === 'function') query = query.select('+huellaSolicitud');
    let operation = await execute(query);
    if (operation) {
      if (operation.huellaSolicitud !== input.huellaSolicitud) throw AppError.conflicto('La clave de operación ya se utilizó con otros datos');
      return { confirmado: operation.resultado === 'ACREDITADA', tardia: operation.resultado === 'TARDIA', idempotente: true, pedidoId: String(operation.pedidoId) };
    }
    operation = await execute(ConfirmacionTransferencia.findOne({ pedidoId: input.pedidoId, referencia: input.referencia }));
    if (operation) return { confirmado: operation.resultado === 'ACREDITADA', tardia: operation.resultado === 'TARDIA', idempotente: true, pedidoId: String(operation.pedidoId) };
    return null;
  }

  async function confirmTransfer({ pedidoId, adminId, referencia, importeAcreditado, idOperacion }) {
    const input = normalizeInput({ pedidoId, adminId, referencia, importeAcreditado, idOperacion });
    const existing = await findPrior(input);
    if (existing) return existing;
    await assertIndexes();

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const retryResult = await findPrior(input);
      if (retryResult) return retryResult;
      const session = await startSession();
      try {
        let result;
        await session.withTransaction(async () => {
          const order = await execute(withSession(Pedido.findById(input.pedidoId), session));
          if (!order) throw AppError.noEncontrado('Pedido no encontrado');
          if (order.metodoPago !== 'TRANSFERENCIA') throw AppError.conflicto('El pedido no utiliza transferencia bancaria');
          if (order.estadoPago !== 'PENDIENTE') throw AppError.conflicto('El pedido ya no admite confirmar una transferencia');
          const expectedCents = parseMoneyToCents(order.total);
          if (expectedCents === null || expectedCents !== input.importeAcreditadoCentavos) {
            throw AppError.conflicto('El importe informado no coincide con el total histórico del pedido');
          }
          const reservations = await execute(withSession(ReservaStock.find({ pedidoId: order._id }), session));
          const now = ahora();
          const allActiveAndValid = reservations.length > 0
            && reservations.every((reservation) => reservation.estado === 'ACTIVA' && reservation.venceEn instanceof Date && reservation.venceEn > now);
          const allReleased = reservations.length > 0 && reservations.every((reservation) => reservation.estado === 'LIBERADA');
          const allExpiredActive = reservations.length > 0 && reservations.every((reservation) => reservation.estado === 'ACTIVA' && reservation.venceEn instanceof Date && reservation.venceEn <= now);
          const isLate = allReleased || allExpiredActive;
          if ((!allActiveAndValid || order.estado === 'CANCELADO') && !isLate) {
            throw AppError.conflicto('Las reservas no permiten confirmar esta transferencia; requiere revisión');
          }

          const receivedAt = now;
          if (isLate) {
            const changed = await Pedido.updateOne(
              { _id: order._id, metodoPago: 'TRANSFERENCIA', estadoPago: 'PENDIENTE' },
              { $set: {
                transferenciaRecibidaEn: receivedAt,
                transferenciaReferencia: input.referencia,
                transferenciaRequiereConciliacion: true,
                notaPago: 'Transferencia informada después del vencimiento; pendiente de conciliación administrativa'
              } },
              { session }
            );
            if ((changed?.modifiedCount ?? changed?.nModified ?? 0) !== 1) throw AppError.conflicto('El pedido cambió durante el registro de la transferencia');
            await ConfirmacionTransferencia.create([{
              pedidoId: order._id,
              adminId: input.adminId,
              idOperacion: input.idOperacion,
              huellaSolicitud: input.huellaSolicitud,
              referencia: input.referencia,
              importeAcreditado: input.importeAcreditado,
              resultado: 'TARDIA',
              recibidoEn: receivedAt
            }], { session });
            result = { confirmado: false, tardia: true, requiereConciliacion: true, idempotente: false, pedidoId: String(order._id) };
            return;
          }

          const proof = transferPaymentAuthorization.issue({
            pedidoId: order._id,
            adminId: input.adminId,
            referencia: input.referencia
          });
          await stockReservationService.confirmPayment(order._id, proof, {
            session,
            paymentAudit: { adminId: input.adminId, referencia: input.referencia }
          });
          await ConfirmacionTransferencia.create([{
            pedidoId: order._id,
            adminId: input.adminId,
            idOperacion: input.idOperacion,
            huellaSolicitud: input.huellaSolicitud,
            referencia: input.referencia,
            importeAcreditado: input.importeAcreditado,
            resultado: 'ACREDITADA',
            recibidoEn: receivedAt
          }], { session });
          result = { confirmado: true, tardia: false, idempotente: false, pedidoId: String(order._id) };
        });
        return result;
      } catch (error) {
        if (isDuplicate(error)) {
          const prior = await findPrior(input);
          if (prior) return prior;
          throw AppError.conflicto('La referencia de transferencia ya fue registrada');
        }
        if (error?.hasErrorLabel?.('TransientTransactionError') || error?.codeName === 'WriteConflict') continue;
        throw error;
      } finally {
        await session.endSession();
      }
    }
    throw AppError.conflicto('No se pudo confirmar la transferencia; reintentá la operación');
  }

  return { confirmTransfer, assertIndexes };
}

module.exports = { createTransferPaymentService, normalizeInput };
