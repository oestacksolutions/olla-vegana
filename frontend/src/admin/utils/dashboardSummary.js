export const DASHBOARD_PERIODS = Object.freeze([
  { value: 'today', label: 'Hoy' },
  { value: '7d', label: 'Últimos 7 días' },
  { value: '30d', label: 'Últimos 30 días' },
])

export function formatDashboardMoney(value) {
  if (typeof value !== 'string' || !/^-?\d+(?:\.\d{1,2})?$/.test(value)) return null
  const negative = value.startsWith('-')
  const [whole, fraction = ''] = (negative ? value.slice(1) : value).split('.')
  const formattedWhole = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(BigInt(whole))
  const symbol = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).formatToParts(0).find(({ type }) => type === 'currency')?.value || '$'
  return `${negative ? '-' : ''}${symbol}\u00a0${formattedWhole},${(fraction + '00').slice(0, 2)}`
}

export function periodLabel(period) {
  return DASHBOARD_PERIODS.find((entry) => entry.value === period)?.label.toLowerCase() || 'período seleccionado'
}

export function buildSummaryParagraph(summary) {
  const orders = Number(summary?.orders?.placed)
  const pending = Number(summary?.orders?.pendingPayment)
  const confirmed = Number(summary?.payments?.confirmedCount)
  const gross = formatDashboardMoney(summary?.payments?.creditedGross)
  const refunds = formatDashboardMoney(summary?.payments?.confirmedRefunds)
  if (![orders, pending, confirmed].every(Number.isSafeInteger)) return null
  const net = summary.payments.netReliable ? formatDashboardMoney(summary.payments.netMovement) : null
  const orderSentence = orders === 0
    ? `Todavía no se registraron pedidos durante ${periodLabel(summary.period)}.`
    : `Durante ${periodLabel(summary.period)} se registraron ${orders} ${orders === 1 ? 'pedido' : 'pedidos'}.`
  const grossSentence = gross ? ` por ${gross}` : '; el importe bruto acreditado no puede calcularse con fiabilidad'
  const refundSentence = refunds ? ` Los reintegros completados registrados suman ${refunds}.` : ' El importe de los reintegros completados no puede calcularse con fiabilidad.'
  return `${orderSentence} Se confirmaron pagos de ${confirmed} ${confirmed === 1 ? 'pedido' : 'pedidos'}${grossSentence}; hay ${pending} ${pending === 1 ? 'pedido pendiente' : 'pedidos pendientes'} de pago en este período.${refundSentence}${net ? ` El movimiento neto acreditado, descontando esos reintegros, es ${net}.` : ' El neto no puede calcularse con fiabilidad con los registros disponibles.'}`
}

export function hasAttentionItems(attention = {}) {
  return Number(attention.transferPaymentsPending) > 0
    || Number(attention.pickupsPending) > 0
    || Number(attention.lowStockCount) > 0
    || Number(attention.outOfStockCount) > 0
}
