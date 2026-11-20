const crypto = require('node:crypto');
const { promisify } = require('node:util');
const scrypt = promisify(crypto.scrypt);
const { sequelize, User, Credential } = require('../models');
const HttpError = require('../utils/httpError');
const { signToken } = require('../utils/tokens');

async function hashPassword(password, salt) {
  return (await scrypt(password, salt, 64)).toString('hex');
}

async function register({ name, email, password }) {
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) {
    throw new HttpError(400, 'Name must contain between 2 and 100 characters');
  }
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    throw new HttpError(400, 'A valid email address is required');
  }
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) {
    throw new HttpError(400, 'Password must contain between 12 and 128 characters');
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = await hashPassword(password, salt);
  const result = await sequelize.transaction(async (transaction) => {
    const user = await User.create({ name: name.trim(), email: email.trim().toLowerCase() }, { transaction });
    const credential = await Credential.create({ userId: user.id, passwordHash, passwordSalt: salt }, { transaction });
    return { user, credential };
  });
  return { user: publicUser(result.user, result.credential), accessToken: signToken({ sub: result.user.id, role: result.credential.role }) };
}

async function login({ email, password }) {
  if (typeof email !== 'string' || typeof password !== 'string') throw new HttpError(400, 'Email and password are required');
  const user = await User.findOne({ where: { email: email.trim().toLowerCase() } });
  if (!user) throw new HttpError(401, 'Invalid email or password');
  const credential = await Credential.findOne({ where: { userId: user.id } });
  if (!credential) throw new HttpError(401, 'Invalid email or password');
  const candidate = Buffer.from(await hashPassword(password, credential.passwordSalt), 'hex');
  const stored = Buffer.from(credential.passwordHash, 'hex');
  if (candidate.length !== stored.length || !crypto.timingSafeEqual(candidate, stored)) {
    throw new HttpError(401, 'Invalid email or password');
  }
  return { user: publicUser(user, credential), accessToken: signToken({ sub: user.id, role: credential.role }) };
}

function publicUser(user, credential) {
  return { id: user.id, name: user.name, email: user.email, role: credential.role };
}

module.exports = { register, login, hashPassword };
