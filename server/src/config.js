require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const required = ['MONGODB_URI', 'REDIS_URL', 'JWT_SECRET'];

function validateEnvironment() {
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length && process.env.NODE_ENV !== 'test') {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

module.exports = {
  port: Number(process.env.PORT || 4000),
  mongoUri: process.env.MONGODB_URI,
  redisUrl: process.env.REDIS_URL,
  jwtSecret: process.env.JWT_SECRET || 'test-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  workerConcurrency: Number(process.env.WORKER_CONCURRENCY || 4),
  validateEnvironment,
};
