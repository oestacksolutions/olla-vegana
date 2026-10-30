import { useMemo } from 'react'
import TransferInstructionsPage from './TransferInstructionsPage'

const DEMO_STATUSES = Object.freeze({
  pendiente: 'PENDIENTE',
  pagado: 'PAGADO',
  vencido: 'VENCIDO',
  cancelado: 'CANCELADO',
})

function createDemoOrder(status) {
  const now = Date.now()
  const expiresAt = status === 'VENCIDO' ? now - 60 * 60 * 1000 : now + 23 * 60 * 60 * 1000

  return {
    pedidoNumero: 'DEMO-000123',
    importe: '$ 45.000,00 (DEMO)',
    venceEn: new Date(expiresAt).toISOString(),
    estado: status,
    estadoPedido: status === 'CANCELADO' ? 'CANCELADO' : 'NUEVO',
    estadoPago: status === 'PAGADO' ? 'APROBADO' : status === 'CANCELADO' ? 'PENDIENTE' : 'PENDIENTE',
    instrucciones: status === 'PENDIENTE' ? {
      titular: 'Titular ficticio DEMO',
      banco: 'Banco de prueba DEMO',
      alias: 'DEMO.NO.TRANSFERIR',
      cbuCvu: '0000000000000000000000',
      importe: '$ 45.000,00 (DEMO)',
      referencia: 'DEMO-000123',
      instrucciones: 'Estos datos son ficticios y sirven únicamente para revisar la interfaz. No realices una transferencia.',
    } : null,
  }
}

function TransferInstructionsPreviewPage({ initialStatus = 'pendiente' }) {
  const status = DEMO_STATUSES[initialStatus] ? initialStatus : 'pendiente'
  const demoOrder = useMemo(() => createDemoOrder(DEMO_STATUSES[status]), [status])

  return <TransferInstructionsPage orderId="demo" demoOrder={demoOrder} demoStatus={status} />
}

export default TransferInstructionsPreviewPage
