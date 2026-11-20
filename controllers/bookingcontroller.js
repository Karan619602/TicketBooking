const { sequelize, Seat, Booking, Show } = require('../models');

const CreateBooking = async (req, res, next) => {
  const { showId, seatId, userId } = req.params;

  try {
    const booking = await sequelize.transaction(async (transaction) => {
      const show = await Show.findByPk(showId, { transaction });
      if (!show) {
        const error = new Error('Show not found');
        error.status = 404;
        throw error;
      }

      // Lock the seat row so two requests cannot reserve it at the same time.
      const seat = await Seat.findOne({
        where: { id: seatId, screenId: show.screenId },
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (!seat) {
        const error = new Error('Seat not found for this show');
        error.status = 404;
        throw error;
      }

      const existingBooking = await Booking.findOne({
        where: { showId, seatId },
        transaction
      });

      if (existingBooking) {
        const error = new Error('Seat is already booked for this show');
        error.status = 409;
        throw error;
      }

      return Booking.create({ showId, seatId, userId }, { transaction });
    });

    res.status(201).json({
      message: 'Seat reserved successfully',
      bookingId: booking.id
    });
  } catch (err) {
    next(err);
  }
};

const GetAllBookings = async (req, res, next) => {
  try {
    const bookings = await Booking.findAll();
    res.status(200).json({ bookings });
  } catch (err) {
    next(err);
  }
};

const CancelSeatBooking = async (req, res, next) => {
  const { BookingId } = req.params;

  try {
    await sequelize.transaction(async (transaction) => {
      const booking = await Booking.findByPk(BookingId, {
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (!booking) {
        const error = new Error('Booking not found');
        error.status = 404;
        throw error;
      }

      await booking.destroy({ transaction });
    });

    res.status(200).json({ message: 'Seat booking cancelled successfully' });
  } catch (err) {
    next(err);
  }
};

module.exports = { CreateBooking, GetAllBookings, CancelSeatBooking };