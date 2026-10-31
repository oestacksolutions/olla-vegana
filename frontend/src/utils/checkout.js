export const CHECKOUT_DRAFT_KEY = 'olla-vegana-checkout-draft'
export const PAYMENT_METHODS = Object.freeze([
  { id: 'MERCADO_PAGO', title: 'Mercado Pago', detail: 'Checkout Pro está en preparación y todavía no acepta pagos.' },
  { id: 'TRANSFERENCIA', title: 'Transferencia bancaria', detail: 'La preferencia queda preparada; no se muestran datos bancarios en esta etapa.' },
])

const DAY_LABELS = Object.freeze({
  LUNES: 'Lunes', MARTES: 'Martes', MIERCOLES: 'Miércoles', JUEVES: 'Jueves',
  VIERNES: 'Viernes', SABADO: 'Sábado', DOMINGO: 'Domingo',
})

export function buildCartValidationPayload(items = []) {
  return {
    articulos: items.map(({ productId, variantId, quantity }) => ({
      productoId: productId,
      varianteId: variantId,
      cantidad: quantity,
    })),
  }
}

export function cartFingerprint(items = []) {
  return JSON.stringify(items.map(({ productId, variantId, quantity }) => [productId, variantId, quantity]))
}

export function availablePickupOptions(response) {
  const points = Array.isArray(response?.puntosRetiro) ? response.puntosRetiro : []
  const special = Array.isArray(response?.retirosEspeciales) ? response.retirosEspeciales : []
  return [
    ...points.filter((item) => item?.disponibleParaSeleccionar === true && item.id && item.nombre)
      .map((item) => ({ ...item, tipo: 'PUNTO', seleccionId: `PUNTO:${item.id}` })),
    ...special.filter((item) => item?.disponibleParaSeleccionar === true && item.id && item.fecha && item.lugar)
      .map((item) => ({ ...item, tipo: 'ESPECIAL', seleccionId: `ESPECIAL:${item.id}` })),
  ]
}

export function formatPickupSchedule(option) {
  if (option.tipo === 'ESPECIAL') {
    const dateLabel = (value) => {
      if (!value) return ''
      const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00-03:00`) : new Date(value)
      return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('es-AR', { dateStyle: 'long', timeZone: 'America/Argentina/Buenos_Aires' }).format(date)
    }
    const start = dateLabel(option.fechaInicio || option.fecha)
    const end = dateLabel(option.fechaFin || option.fechaInicio || option.fecha)
    const range = start && end && start !== end ? `${start} al ${end}` : start
    const schedules = Array.isArray(option.horariosRetiro) ? option.horariosRetiro : []
    const hours = schedules.length
      ? schedules.map((schedule) => `${dateLabel(schedule.fecha)}: ${schedule.horaInicio} a ${schedule.horaFin}`).join(' · ')
      : option.horaInicio && option.horaFin ? `${option.horaInicio} a ${option.horaFin}` : ''
    return [range, hours].filter(Boolean).join(' · ')
  }
  const schedules = Array.isArray(option.horariosHabituales) ? option.horariosHabituales : []
  const formatted = schedules.map((schedule) => {
    const day = DAY_LABELS[schedule.diaSemana] || schedule.diaSemana
    return `${day}: ${schedule.horaInicio} a ${schedule.horaFin}`
  })
  if (formatted.length) return formatted.join(' · ')
  return typeof option.horarios === 'string' && option.horarios.trim()
    ? option.horarios.trim()
    : 'Horarios a confirmar'
}

export function isPickupSelectionAvailable(pickupId, pickupOptions = []) {
  return Boolean(pickupId && pickupOptions.some((option) => option.seleccionId === pickupId))
}

export function reconcilePickupSelection(pickupId, pickupOptions = []) {
  const available = isPickupSelectionAvailable(pickupId, pickupOptions)
  return { pickupId: available ? pickupId : '', invalidated: Boolean(pickupId && !available) }
}

export function validateBuyerFields(form) {
  const errors = {}
  const nombre = String(form?.nombre || '').trim()
  const apellido = String(form?.apellido || '').trim()
  const correo = String(form?.correo || '').trim()
  const telefono = String(form?.telefono || '').trim()
  const observaciones = String(form?.observaciones || '').trim()

  if (!nombre) errors.nombre = 'Ingresá tu nombre.'
  else if (nombre.length > 80) errors.nombre = 'El nombre no puede superar 80 caracteres.'
  if (!apellido) errors.apellido = 'Ingresá tu apellido.'
  else if (apellido.length > 80) errors.apellido = 'El apellido no puede superar 80 caracteres.'
  if (!correo) errors.correo = 'Ingresá tu correo electrónico.'
  else if (correo.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) errors.correo = 'Revisá el formato del correo electrónico.'
  const digits = telefono.replace(/\D/g, '')
  if (!telefono) errors.telefono = 'Ingresá un teléfono de contacto.'
  else if (!/^\+?[\d\s().-]+$/.test(telefono) || digits.length < 8 || digits.length > 15) {
    errors.telefono = 'Ingresá un teléfono válido con código de área.'
  }
  if (observaciones.length > 1000) errors.observaciones = 'Las observaciones no pueden superar 1000 caracteres.'

  return errors
}

export function validatePickupSelection(pickupId, pickupOptions = []) {
  return isPickupSelectionAvailable(pickupId, pickupOptions)
    ? {}
    : { retiro: 'Seleccioná una opción de retiro disponible.' }
}

export function validatePaymentSelection(paymentMethod) {
  const errors = {}
  if (!PAYMENT_METHODS.some((method) => method.id === paymentMethod)) {
    errors.metodoPago = 'Seleccioná un método de pago.'
  }
  return errors
}

export function validateCheckoutForm(form, options = {}) {
  return {
    ...validateBuyerFields(form),
    ...validatePickupSelection(options.pickupId, options.pickupOptions),
    ...validatePaymentSelection(options.paymentMethod),
  }
}

export function formatARS(value) {
  if (value === null || value === undefined || value === '') return '—'
  const amount = Number(typeof value?.toString === 'function' ? value.toString() : value)
  if (!Number.isFinite(amount) || amount < 0) return '—'
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', maximumFractionDigits: 2,
  }).format(amount)
}

export function readCheckoutDraft(storage) {
  try {
    const checkoutStorage = storage ?? globalThis.sessionStorage
    const draft = JSON.parse(checkoutStorage?.getItem(CHECKOUT_DRAFT_KEY) || 'null')
    if (!draft || typeof draft !== 'object' || Array.isArray(draft)) return null
    return {
      form: {
        nombre: typeof draft.form?.nombre === 'string' ? draft.form.nombre : '',
        apellido: typeof draft.form?.apellido === 'string' ? draft.form.apellido : '',
        correo: typeof draft.form?.correo === 'string' ? draft.form.correo : '',
        telefono: typeof draft.form?.telefono === 'string' ? draft.form.telefono : '',
        observaciones: typeof draft.form?.observaciones === 'string' ? draft.form.observaciones : '',
      },
      pickupId: typeof draft.pickupId === 'string' ? draft.pickupId : '',
      paymentMethod: typeof draft.paymentMethod === 'string' ? draft.paymentMethod : '',
    }
  } catch {
    return null
  }
}

export function saveCheckoutDraft(draft, storage) {
  try {
    const checkoutStorage = storage ?? globalThis.sessionStorage
    checkoutStorage?.setItem(CHECKOUT_DRAFT_KEY, JSON.stringify(draft))
    return Boolean(checkoutStorage)
  } catch {
    return false
  }
}
