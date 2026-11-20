const authService = require('../services/authservice');

async function Register(req, res, next) {
  try {
    const result = await authService.register(req.body || {});
    res.status(201).json({ message: 'Account created', ...result });
  } catch (error) { next(error); }
}
async function Login(req, res, next) {
  try {
    res.status(200).json({ message: 'Login successful', ...(await authService.login(req.body || {})) });
  } catch (error) { next(error); }
}
module.exports = { Register, Login };
