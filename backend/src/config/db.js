const mongoose = require('mongoose');

const connectDB = async (uri) => {
  const connectionUri = uri || require('./env').MONGODB_URI;
  await mongoose.connect(connectionUri, { autoCreate: false, autoIndex: false });
  console.log('Conexión a MongoDB establecida.');
  return mongoose.connection;
};

module.exports = connectDB;
