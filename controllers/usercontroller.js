const { User } = require('../models');
const HttpError = require('../utils/httpError');

const CreateUser = async (req, res, next) => {
  try {
    const { name, email } = req.body;
    if (typeof name !== 'string' || name.trim().length < 2) {
      throw new HttpError(400, 'Name must contain at least 2 characters');
    }
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new HttpError(400, 'A valid email address is required');
    }

    const user = await User.create({
      name: name.trim(),
      email: email.trim().toLowerCase()
    });
    res.status(201).json({
      message: 'User created successfully',
      user
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { CreateUser };
