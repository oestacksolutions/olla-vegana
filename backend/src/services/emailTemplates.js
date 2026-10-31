const { parseMoneyToCents, formatCents } = require('./cartValidationService');

const COLORS = Object.freeze({ cream: '#FFF8E9', violet: '#AF71DD', ink: '#30283A', muted: '#655D6B' });

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function amount(value) {
  const cents = parseMoneyToCents(value);
  if (cents === null) return 'Importe no disponible';
  const whole = cents / 100n;
  const fraction = String(cents % 100n).padStart(2, '0');
  const formattedWhole = new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 0
  }).format(whole);
  return `${formattedWhole},${fraction}`;
}

function itemSubtotal(item) {
  if (item.subtotal != null) return item.subtotal;
  const unitCents = parseMoneyToCents(item.precio);
  if (unitCents === null || !Number.isSafeInteger(item.cantidad)) return null;
  return formatCents(unitCents * BigInt(item.cantidad));
}

function pickupDescription(order) {
  const regular = order.puntoRetiroSnapshot;
  if (regular) {
    const hours = Array.isArray(regular.horariosHabituales)
      ? regular.horariosHabituales.map((slot) => `${slot.diaSemana || ''} ${slot.horaInicio || ''}–${slot.horaFin || ''}`.trim()).filter(Boolean).join(' · ')
      : regular.horarios;
    return [regular.nombre, regular.direccion, hours, regular.indicaciones].filter(Boolean).join('\n');
  }
  const special = order.retiroEspecialSnapshot;
  if (special) {
    const schedules = Array.isArray(special.horariosRetiro)
      ? special.horariosRetiro.map((slot) => `${slot.fecha ? new Date(slot.fecha).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }) : ''} ${slot.horaInicio || ''}–${slot.horaFin || ''}`.trim()).filter(Boolean).join(' · ')
      : '';
    return [special.evento || special.nombre, special.lugar, special.direccion, schedules || special.horaInicio || special.horaFin, special.indicaciones].filter(Boolean).join('\n');
  }
  return 'La información de retiro no está disponible.';
}

function createEmailContent({ tipo, order, items = [], transferInstructions = null }) {
  const name = `${order.nombre || ''} ${order.apellido || ''}`.trim() || '¡Hola!';
  const number = `OV-${order.numero}`;
  const rows = items.map((item) => {
    const variant = item.detalleVariante || (item.atributosVariante || []).map((entry) => `${entry.atributo}: ${entry.valor}`).join(' · ');
    const line = `${item.cantidad} × ${item.nombreProducto}${variant ? ` (${variant})` : ''} — ${amount(itemSubtotal(item))}`;
    return line;
  });
  const total = amount(order.total);
  const templates = {
    PEDIDO_CREADO: {
      subject: `Recibimos tu pedido ${number}`,
      title: 'Recibimos tu pedido',
      intro: `Hola ${name}, registramos tu pedido. Esto confirma la recepción del pedido, no la acreditación del pago.`,
      extra: order.metodoPago === 'TRANSFERENCIA' && transferInstructions
        ? `Transferencia bancaria\nTitular: ${transferInstructions.titular}\n${transferInstructions.alias ? `Alias: ${transferInstructions.alias}\n` : ''}${transferInstructions.cbuCvu ? `CBU/CVU: ${transferInstructions.cbuCvu}\n` : ''}Importe: ${transferInstructions.importe}\nVencimiento: ${transferInstructions.venceEn}\nReferencia: ${transferInstructions.referencia}\n${transferInstructions.instrucciones}`
        : '',
      ending: `Medio de pago: ${order.metodoPago}. Estado inicial del pedido: ${order.estado || 'NUEVO'}. Estado del pago: ${order.estadoPago || 'PENDIENTE'}.\nRetiro:\n${pickupDescription(order)}`
    },
    PAGO_CONFIRMADO: {
      subject: `Pago confirmado para el pedido ${number}`,
      title: 'Pago confirmado',
      intro: `Hola ${name}, registramos la acreditación del pago de tu pedido.`,
      extra: '', ending: `Importe del pedido: ${total}. Medio de pago: ${order.metodoPago}.`
    },
    PEDIDO_CANCELADO: {
      subject: `Actualización de tu pedido ${number}`,
      title: 'Pedido cancelado',
      intro: `Hola ${name}, tu pedido figura como cancelado.`,
      extra: order.estadoPago === 'APROBADO' ? 'La cancelación del pedido no significa que el dinero haya sido reintegrado. Si corresponde, el reintegro se gestiona por separado.' : '',
      ending: `Estado de pago registrado: ${order.estadoPago || 'PENDIENTE'}.`
    },
    LISTO_PARA_RETIRAR: {
      subject: `Tu pedido ${number} está listo para retirar`,
      title: 'Tu pedido está listo para retirar',
      intro: `Hola ${name}, ya podés retirar tu pedido.`,
      extra: pickupDescription(order), ending: 'Consultá la información del punto de retiro antes de acercarte.'
    }
  };
  const template = templates[tipo];
  if (!template) throw new TypeError('Tipo de correo transaccional desconocido');
  const lines = [`${template.title}`, '', template.intro, '', `Pedido: ${number}`, ...rows, `Total: ${total}`, '', template.extra, template.ending].filter((line) => line !== '');
  const text = lines.join('\n');
  const html = `<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta charset="utf-8"><title>${escapeHtml(template.title)}</title></head><body style="margin:0;background:${COLORS.cream};font-family:Arial,Helvetica,sans-serif;color:${COLORS.ink};"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${COLORS.cream};padding:24px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden"><tr><td style="background:${COLORS.violet};padding:22px 26px;color:#fff;font-size:22px;font-weight:bold">Olla Vegana</td></tr><tr><td style="padding:26px"><h1 style="margin:0 0 16px;font-size:24px">${escapeHtml(template.title)}</h1><p style="line-height:1.6">${escapeHtml(template.intro)}</p><p style="line-height:1.6"><strong>Pedido:</strong> ${escapeHtml(number)}</p>${rows.length ? `<ul style="padding-left:20px;line-height:1.7">${rows.map((row) => `<li>${escapeHtml(row)}</li>`).join('')}</ul>` : ''}<p style="font-size:18px"><strong>Total: ${escapeHtml(total)}</strong></p>${template.extra ? `<div style="white-space:pre-line;line-height:1.7;background:${COLORS.cream};padding:16px;border-radius:8px">${escapeHtml(template.extra)}</div>` : ''}<p style="line-height:1.6">${escapeHtml(template.ending)}</p></td></tr><tr><td style="padding:16px 26px;color:${COLORS.muted};font-size:12px">Olla Vegana</td></tr></table></td></tr></table></body></html>`;
  return { to: order.correo, subject: template.subject, text, html };
}

module.exports = { createEmailContent, escapeHtml, pickupDescription };
