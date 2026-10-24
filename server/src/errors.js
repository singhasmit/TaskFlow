class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
  }
}

function errorHandler(error, req, res, next) {
  const status = error.statusCode || (error.name === 'ValidationError' ? 400 : 500);
  if (process.env.NODE_ENV !== 'test') console.error(error);
  res.status(status).json({ error: error.message || 'Internal server error' });
}

module.exports = { AppError, errorHandler };
