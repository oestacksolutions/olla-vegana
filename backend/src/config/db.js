const mongoose = require('mongoose');
const logger = require('../utils/observability');

const connectDB = async (uri) => {
  const connectionUri = uri || require('./env').MONGODB_URI;
  await mongoose.connect(connectionUri, { autoCreate: false, autoIndex: false });
  logger.info('database.connected');
  return mongoose.connection;
};

module.exports = connectDB;
