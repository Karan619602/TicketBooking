const crypto = require('node:crypto');

function getSecret() {
  const secret = process.env.AUTH_TOKEN_SECRET;
  if (process.env.NODE_ENV === 'production' && (!secret || secret.length < 32)) {
    throw new Error('AUTH_TOKEN_SECRET must contain at least 32 characters in production');
  }
  return secret || 'development-only-secret-change-before-deploying';
}

function signToken(payload, expiresInSeconds = 3600) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ ...payload, iat: now, exp: now + expiresInSeconds })).toString('base64url');
  const unsigned = header + '.' + body;
  const signature = crypto.createHmac('sha256', getSecret()).update(unsigned).digest('base64url');
  return unsigned + '.' + signature;
}

function verifyToken(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new Error('Invalid token');
  const unsigned = parts[0] + '.' + parts[1];
  const expected = crypto.createHmac('sha256', getSecret()).update(unsigned).digest();
  const actual = Buffer.from(parts[2], 'base64url');
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) throw new Error('Invalid token signature');
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  if (!payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) throw new Error('Token expired');
  return payload;
}

module.exports = { signToken, verifyToken };
