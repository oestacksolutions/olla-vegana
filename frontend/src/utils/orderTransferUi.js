const ACCESS_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/

export function readOrderAccessToken(hash = globalThis.location?.hash || '') {
  if (typeof hash !== 'string' || !hash.startsWith('#')) return ''
  const token = new URLSearchParams(hash.slice(1)).get('acceso') || ''
  return ACCESS_TOKEN_PATTERN.test(token) ? token : ''
}

export function transferStatusPresentation(status) {
  const messages = {
    PENDIENTE: ['Pendiente de pago', 'La reserva se mantiene hasta el vencimiento indicado. El equipo debe verificar la acreditación.'],
    PAGADO: ['Pago confirmado', 'El equipo confirmó administrativamente la transferencia.'],
    VENCIDO: ['Plazo vencido', 'El plazo de reserva terminó. Estas instrucciones ya no son válidas.'],
    CANCELADO: ['Pedido cancelado', 'Este pedido fue cancelado y no admite pagos.'],
    RECHAZADO: ['Pago rechazado', 'El pago no fue aceptado. Contactá a Olla Vegana para recibir ayuda.'],
    REEMBOLSADO: ['Pago reembolsado', 'El pago figura como reembolsado.'],
    CONFIGURACION_PENDIENTE: ['Instrucciones no disponibles', 'Los datos bancarios todavía no están configurados. No realices una transferencia con datos recibidos por otro medio.'],
    REQUIERE_REVISION: ['Pedido en revisión', 'No podemos ofrecer instrucciones porque la reserva requiere revisión. Contactá a Olla Vegana.'],
  }
  return messages[status] || ['No pudimos consultar el pedido', 'Revisá el enlace e intentá nuevamente.']
}
