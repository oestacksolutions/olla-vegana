const env = require('./src/config/env');
const app = require('./src/app');

const PORT = env.PORT;

app.listen(PORT, () => {
  console.log(`Servidor de Olla Vegana corriendo en el puerto ${PORT}`);
});
