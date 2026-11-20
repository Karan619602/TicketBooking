const { Screen, Seat } = require('../models');
const HttpError = require('../utils/httpError');

const CreateScreen = async (req, res, next) => {
  try {
    const { name, capacity, location } = req.body;
    const parsedCapacity = Number(capacity);
    if (typeof name !== 'string' || !name.trim()) {
      throw new HttpError(400, 'Screen name is required');
    }
    if (!Number.isInteger(parsedCapacity) || parsedCapacity < 1 || parsedCapacity > 1000) {
      throw new HttpError(400, 'Capacity must be an integer between 1 and 1000');
    }

    const screen = await Screen.create({
      name: name.trim(),
      capacity: parsedCapacity,
      location: typeof location === 'string' ? location.trim() : null
    });
    res.status(201).json({ message: 'Screen created successfully', screen });
  } catch (error) {
    next(error);
  }
};

const GetScreens = async (req, res, next) => {
  try {
    const screens = await Screen.findAll({
      include: [{ model: Seat, attributes: ['id'] }],
      order: [['id', 'ASC']]
    });
    res.status(200).json({
      screens: screens.map((screen) => ({
        id: screen.id,
        name: screen.name,
        capacity: screen.capacity,
        location: screen.location,
        seatCount: screen.Seats.length
      }))
    });
  } catch (error) {
    next(error);
  }
};

const CreateSeats = async (req, res, next) => {
  try {
    const screenId = Number(req.params.screenId);
    const screen = await Screen.findByPk(screenId);
    if (!screen) throw new HttpError(404, 'Screen not found');

    const { seats, count, category = 'standard', price = 0 } = req.body;
    let seatList = seats;
    if (!Array.isArray(seatList)) {
      const total = Number(count);
      if (!Number.isInteger(total) || total < 1 || total > screen.capacity) {
        throw new HttpError(400, 'Provide a seats array or a valid count');
      }
      seatList = Array.from({ length: total }, (_, index) => ({
        number: index + 1,
        category,
        price
      }));
    }

    if (!seatList.length || seatList.length > screen.capacity) {
      throw new HttpError(400, 'Seat count must be between 1 and screen capacity');
    }
    const rows = seatList.map((seat) => ({
      number: Number(seat.number),
      category: seat.category || 'standard',
      price: Number(seat.price || 0),
      screenId
    }));
    if (rows.some((seat) =>
      !Number.isInteger(seat.number) || seat.number < 1 ||
      !Number.isFinite(seat.price) || seat.price < 0
    )) {
      throw new HttpError(400, 'Each seat needs a positive number and a non-negative price');
    }

    const created = await Seat.bulkCreate(rows, { validate: true });
    res.status(201).json({ message: 'Seats created successfully', seats: created });
  } catch (error) {
    next(error);
  }
};

module.exports = { CreateScreen, GetScreens, CreateSeats };
