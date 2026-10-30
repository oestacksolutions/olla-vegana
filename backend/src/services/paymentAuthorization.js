function createPaymentAuthorization() {
  const proofs = new WeakSet();
  return {
    issue({ pedidoId, orderId, snapshotHash }) {
      const proof = Object.freeze({ provider: 'MERCADO_PAGO', pedidoId: String(pedidoId), orderId, snapshotHash });
      proofs.add(proof);
      return proof;
    },
    async verify({ pedidoId, authorization }) {
      return Boolean(authorization && proofs.has(authorization) && authorization.pedidoId === String(pedidoId));
    }
  };
}

module.exports = { createPaymentAuthorization };
