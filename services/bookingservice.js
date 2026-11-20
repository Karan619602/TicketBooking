const crypto = require('node:crypto');
const { Op } = require('sequelize');
const { sequelize, User, Show, Seat, Booking, SeatHold } = require('../models');
const HttpError = require('../utils/httpError');
const waitlistService = require('./waitlistservice');

function getFingerprint(userId, showId, seatId) {
  return crypto.createHash('sha256').update([userId, showId, seatId].join(':')).digest('hex');
}

async function createBooking({ userId, showId, seatId, idempotencyKey }) {
  const fingerprint = getFingerprint(userId, showId, seatId);
  const scopedKey = idempotencyKey ? userId + ':' + idempotencyKey : null;

  if (scopedKey) {
    const previous = await Booking.findOne({ where: { idempotencyKey: scopedKey } });
    if (previous) {
      if (previous.requestFingerprint !== fingerprint) throw new HttpError(409, 'This idempotency key was already used for a different booking request');
      return { booking: previous, replayed: true };
    }
  }

  try {
    return await sequelize.transaction(async (transaction) => {
      const user = await User.findByPk(userId, { transaction });
      if (!user) throw new HttpError(404, 'User not found');

      const show = await Show.findByPk(showId, { transaction, lock: transaction.LOCK.UPDATE });
      if (!show) throw new HttpError(404, 'Show not found');
      if (new Date(show.endTime) <= new Date()) throw new HttpError(400, 'This show has already ended');

      const seat = await Seat.findOne({
        where: { id: seatId, screenId: show.screenId },
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      if (!seat) throw new HttpError(404, 'Seat not found for this show');

      if (scopedKey) {
        const previous = await Booking.findOne({ where: { idempotencyKey: scopedKey }, transaction });
        if (previous) {
          if (previous.requestFingerprint !== fingerprint) throw new HttpError(409, 'This idempotency key was already used for a different booking request');
          return { booking: previous, replayed: true };
        }
      }

      const existingBooking = await Booking.findOne({ where: { showId, seatId, status: 'confirmed' }, transaction });
      if (existingBooking) throw new HttpError(409, 'This seat is already booked for the selected show');

      const now = new Date();
      await SeatHold.update({ status: 'expired' }, {
        where: { showId, seatId, status: 'active', expiresAt: { [Op.lte]: now } }, transaction
      });
      const activeHold = await SeatHold.findOne({
        where: { showId, seatId, status: 'active', expiresAt: { [Op.gt]: now } }, transaction
      });
      if (activeHold) throw new HttpError(409, 'This seat is temporarily held; complete checkout or wait for the hold to expire');

      const booking = await Booking.create({
        userId, showId, seatId, status: 'confirmed', totalAmount: seat.price,
        idempotencyKey: scopedKey,
        requestFingerprint: scopedKey ? fingerprint : null
      }, { transaction });
      return { booking, replayed: false };
    });
  } catch (error) {
    if (scopedKey && error.name === 'SequelizeUniqueConstraintError') {
      const previous = await Booking.findOne({ where: { idempotencyKey: scopedKey } });
      if (previous && previous.requestFingerprint === fingerprint) return { booking: previous, replayed: true };
      if (previous) throw new HttpError(409, 'This idempotency key was already used for a different booking request');
    }
    throw error;
  }
}

async function cancelBooking({ bookingId, userId }) {
  return sequelize.transaction(async (transaction) => {
    // Read once to discover the show, then lock rows in the same show -> booking
    // order used by booking creation to avoid lock-order inversions.
    const initial = await Booking.findByPk(bookingId, { transaction });
    if (!initial) throw new HttpError(404, 'Booking not found');
    const show = await Show.findByPk(initial.showId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!show) throw new HttpError(404, 'Show not found');
    const booking = await Booking.findByPk(bookingId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!booking) throw new HttpError(404, 'Booking not found');
    if (userId && Number(userId) !== booking.userId) throw new HttpError(403, 'You can only cancel your own booking');
    if (booking.status === 'cancelled') throw new HttpError(409, 'Booking has already been cancelled');

    const seat = await Seat.findByPk(booking.seatId, { transaction, lock: transaction.LOCK.UPDATE });
    booking.status = 'cancelled';
    await booking.save({ transaction });

    const promotion = await waitlistService.promoteNext({ show, seat, transaction });
    return { booking, promotion };
  });
}

module.exports = { createBooking, cancelBooking };
