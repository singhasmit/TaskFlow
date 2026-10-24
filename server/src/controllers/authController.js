const { validationResult } = require('express-validator');
const User = require('../models/User');
const { issueToken } = require('../auth');
const { AppError } = require('../errors');

function validation(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new AppError(errors.array()[0].msg, 400);
}

async function register(req, res, next) {
  try {
    validation(req);
    const { name, email, password } = req.body;
    const user = await User.create({ name, email, passwordHash: await User.hashPassword(password) });
    res.status(201).json({ token: issueToken(user), user: { id: user.id, name: user.name, email: user.email } });
  } catch (error) {
    if (error.code === 11000) return next(new AppError('Email is already registered', 409));
    next(error);
  }
}

async function login(req, res, next) {
  try {
    validation(req);
    const user = await User.findOne({ email: req.body.email.toLowerCase() }).select('+passwordHash');
    if (!user || !(await user.comparePassword(req.body.password))) throw new AppError('Invalid email or password', 401);
    res.json({ token: issueToken(user), user: { id: user.id, name: user.name, email: user.email } });
  } catch (error) { next(error); }
}

module.exports = { register, login };
