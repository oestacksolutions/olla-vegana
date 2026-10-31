const mongoose = require('mongoose');
const env = require('../src/config/env');
const Pedido = require('../src/models/Pedido');
const ItemPedido = require('../src/models/ItemPedido');
const EmailOutbox = require('../src/models/EmailOutbox');
const Configuracion = require('../src/models/Configuracion');
const ReservaStock = require('../src/models/ReservaStock');
const { createEmailProvider } = require('../src/services/emailProvider');
const { createEmailOutboxService } = require('../src/services/emailOutboxService');
const { createTransferInstructionsService } = require('../src/services/transferInstructionsService');
const { createOrderAccessTokenService } = require('../src/services/orderAccessToken');

async function main() {
  const [command = 'process', ...args] = process.argv.slice(2);
  if (command === 'process' && !env.EMAIL_SENDING_ENABLED) {
    process.stdout.write('El procesamiento está deshabilitado; no se conectó a MongoDB ni se enviaron correos.\n');
    return;
  }
  if (!['process', 'reconcile'].includes(command)) throw new Error('Uso: npm run email:outbox -- [process [límite] | reconcile <id> <sent|retry|failed>]');
  await mongoose.connect(env.MONGODB_URI);
  try {
    const orderAccessTokens = createOrderAccessTokenService(env.JWT_SECRET);
    const transferInstructionsService = createTransferInstructionsService({ Configuracion, Pedido, ReservaStock }, { orderAccessTokens });
    const service = createEmailOutboxService(
      { EmailOutbox, Pedido, ItemPedido },
      { provider: createEmailProvider(env), transferInstructionsService }
    );
    if (command === 'reconcile') {
      const [id, action] = args;
      if (!id || !action) throw new Error('Indica un ID de outbox y la decisión sent, retry o failed.');
      const updated = await service.reconcile(id, action);
      process.stdout.write(updated ? 'Registro conciliado.\n' : 'No se encontró un evento indeterminado compatible.\n');
      return;
    }
    const requested = args[0] === undefined ? 20 : Number(args[0]);
    const result = await service.processBatch(requested);
    process.stdout.write(`Eventos procesados: ${result.procesados}.\n`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  process.stderr.write(`No se pudo procesar el outbox (${String(error?.code || error?.name || 'ERROR')}).\n`);
  process.exitCode = 1;
});
