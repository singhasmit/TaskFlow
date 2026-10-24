const mongoose = require('mongoose');
const { mongoUri } = require('./config');

async function connectDatabase() {
  await mongoose.connect(mongoUri);
  console.log('MongoDB connected');
}

module.exports = { connectDatabase };
