const jwt = require('jsonwebtoken');
const User = require('./models/User');
const { jwtSecret, jwtExpiresIn } = require('./config');
const { AppError } = require('./errors');

function issueToken(user) {
  return jwt.sign({ sub: user.id }, jwtSecret, { expiresIn: jwtExpiresIn });
}

async function requireAuth(req, res, next) {
  try {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) throw new AppError('Authentication required', 401);
    const payload = jwt.verify(token, jwtSecret);
    const user = await User.findById(payload.sub);
    if (!user) throw new AppError('User no longer exists', 401);
    req.user = user;
    next();
  } catch (error) {
    next(error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError' ? new AppError('Invalid or expired token', 401) : error);
  }
}

module.exports = { issueToken, requireAuth };
