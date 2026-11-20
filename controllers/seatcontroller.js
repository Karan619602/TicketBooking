const { Seat, Show, Booking } = require('../models');
const HttpError = require('../utils/httpError');

const checkseats = async (req, res, next) => {
  try {
    const showId = Number(req.params.showId);
    if (!Number.isInteger(showId) || showId < 1) {
      throw new HttpError(400, 'A valid show ID is required');
    }

    const show = await Show.findByPk(showId);
    if (!show) throw new HttpError(404, 'Show not found');

    const [seats, bookings] = await Promise.all([
      Seat.findAll({
        where: { screenId: show.screenId },
        order: [['number', 'ASC']],
        attributes: ['id', 'number', 'category', 'price', 'screenId']
      }),
      Booking.findAll({
        where: { showId, status: 'confirmed' },
        attributes: ['seatId']
      })
    ]);

    const bookedSeatIds = new Set(bookings.map((booking) => booking.seatId));
    const availableSeats = seats.map((seat) => ({
      ...seat.toJSON(),
      available: !bookedSeatIds.has(seat.id)
    }));

    res.status(200).json({
      showId,
      totalSeats: availableSeats.length,
      availableCount: availableSeats.filter((seat) => seat.available).length,
      seats: availableSeats
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { checkseats };
