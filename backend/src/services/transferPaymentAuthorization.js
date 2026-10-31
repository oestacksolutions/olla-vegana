function createTransferPaymentAuthorization() {
  const proofs = new WeakSet();
  return {
    issue({ pedidoId, adminId, referencia }) {
      const proof = Object.freeze({
        provider: 'TRANSFERENCIA',
        pedidoId: String(pedidoId),
        adminId: String(adminId),
        referencia
      });
      proofs.add(proof);
      return proof;
    },
    async verify({ pedidoId, authorization }) {
      return Boolean(authorization && proofs.has(authorization)
        && authorization.pedidoId === String(pedidoId)
        && authorization.provider === 'TRANSFERENCIA');
    }
  };
}

module.exports = { createTransferPaymentAuthorization };
