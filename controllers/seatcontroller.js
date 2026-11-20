const { Seat, Show, Booking } = require('../models');

const checkseats = async (req, res, next) => {
  try {
    const { showId } = req.params;
    const show = await Show.findByPk(showId);

    if (!show) {
      return res.status(404).json({ message: 'Show not found' });
    }

    const seats = await Seat.findAll({
      where: { screenId: show.screenId },
      order: [['number', 'ASC']]
    });

    const bookings = await Booking.findAll({
      where: { showId },
      attributes: ['seatId']
    });

    const bookedSeatIds = new Set(bookings.map((booking) => booking.seatId));
    const availableSeats = seats.filter((seat) => !bookedSeatIds.has(seat.id));

    res.status(200).json({
      totalSeats: seats.length,
      availableSeats
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { checkseats };