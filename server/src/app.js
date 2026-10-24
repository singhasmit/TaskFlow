const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const routes = require('./routes');
const { clientUrl } = require('./config');
const { errorHandler } = require('./errors');

const app = express();
app.use(helmet());
app.use(cors({ origin: clientUrl }));
app.use(express.json({ limit: '100kb' }));
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV === 'production' ? 1000 : 5000,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many requests. Please wait and try again.' },
}));
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api', routes);
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));
app.use(errorHandler);
module.exports = app;
