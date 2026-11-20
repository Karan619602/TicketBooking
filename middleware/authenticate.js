const HttpError = require('../utils/httpError');
const { verifyToken } = require('../utils/tokens');

function authenticate(req, res, next) {
  const header = req.get('Authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return next(new HttpError(401, 'A Bearer access token is required'));
  try {
    const payload = verifyToken(match[1]);
    req.auth = { userId: Number(payload.sub), role: payload.role };
    if (!Number.isInteger(req.auth.userId) || req.auth.userId < 1) throw new Error('Invalid subject');
    next();
  } catch {
    next(new HttpError(401, 'The access token is invalid or expired'));
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.auth || !roles.includes(req.auth.role)) return next(new HttpError(403, 'You do not have permission to access this resource'));
    next();
  };
}

module.exports = { authenticate, requireRole };
