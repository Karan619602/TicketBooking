const crypto = require('node:crypto');
const { sequelize, Show, Seat, Booking, SeatHold, Payment } = require('../models');
const HttpError = require('../utils/httpError');
const waitlistService = require('./waitlistservice');

async function createIntent({ userId, holdId, idempotencyKey }) {
  return sequelize.transaction(async (transaction) => {
    const initial = await SeatHold.findByPk(holdId, { transaction });
    if (!initial) throw new HttpError(404, 'Seat hold not found');
    const show = await Show.findByPk(initial.showId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!show) throw new HttpError(404, 'Show not found');
    const hold = await SeatHold.findByPk(holdId, { transaction, lock: transaction.LOCK.UPDATE });
    if (hold.userId !== userId) throw new HttpError(403, 'You can only pay for your own seat holds');
    if (hold.status !== 'active' || new Date(hold.expiresAt) <= new Date()) throw new HttpError(409, 'Seat hold is no longer active');
    if (idempotencyKey) {
      const previous = await Payment.findOne({ where: { idempotencyKey }, transaction });
      if (previous) {
        if (previous.holdId !== hold.id || previous.userId !== userId) throw new HttpError(409, 'Idempotency key was already used for another payment');
        return { payment: previous, created: false };
      }
    }
    const existing = await Payment.findOne({ where: { holdId: hold.id }, transaction });
    if (existing) return { payment: existing, created: false };
    const seat = await Seat.findByPk(hold.seatId, { transaction });
    const payment = await Payment.create({
      userId, holdId, amount: seat.price, currency: 'INR', status: 'pending', idempotencyKey: idempotencyKey || null
    }, { transaction });
    return { payment, created: true };
  });
}

async function confirmPayment({ userId, paymentId }) {
  return sequelize.transaction(async (transaction) => {
    const initial = await Payment.findByPk(paymentId, { transaction });
    if (!initial) throw new HttpError(404, 'Payment intent not found');
    const initialHold = await SeatHold.findByPk(initial.holdId, { transaction });
    if (!initialHold) throw new HttpError(404, 'Seat hold not found');
    const show = await Show.findByPk(initialHold.showId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!show) throw new HttpError(404, 'Show not found');
    const payment = await Payment.findByPk(paymentId, { transaction, lock: transaction.LOCK.UPDATE });
    const hold = await SeatHold.findByPk(payment.holdId, { transaction, lock: transaction.LOCK.UPDATE });
    if (payment.userId !== userId || hold.userId !== userId) throw new HttpError(403, 'You can only confirm your own payment');
    if (payment.status === 'succeeded') return { payment, booking: await Booking.findByPk(payment.bookingId, { transaction }), replayed: true };
    if (payment.status !== 'pending') throw new HttpError(409, 'This payment cannot be confirmed');
    if (hold.status !== 'active' || new Date(hold.expiresAt) <= new Date()) {
      hold.status = 'expired';
      payment.status = 'failed';
      payment.failureReason = 'Seat hold expired before payment confirmation';
      await hold.save({ transaction });
      await payment.save({ transaction });
      return { payment, booking: null, replayed: false };
    }

    // Deterministic local adapter: no card data is collected or sent to a provider.
    // Set PAYMENT_SIMULATOR_OUTCOME=decline to exercise failure recovery.
    if ((process.env.PAYMENT_SIMULATOR_OUTCOME || 'success').toLowerCase() === 'decline') {
      payment.status = 'failed';
      payment.failureReason = 'Payment declined by the development simulator';
      hold.status = 'released';
      await payment.save({ transaction });
      await hold.save({ transaction });
      return { payment, booking: null, replayed: false };
    }

    const alreadyBooked = await Booking.findOne({
      where: { showId: hold.showId, seatId: hold.seatId, status: 'confirmed' }, transaction
    });
    if (alreadyBooked) throw new HttpError(409, 'This seat was booked before payment completed');
    const booking = await Booking.create({
      userId, showId: hold.showId, seatId: hold.seatId, status: 'confirmed', totalAmount: payment.amount
    }, { transaction });
    payment.status = 'succeeded';
    payment.bookingId = booking.id;
    payment.providerReference = 'SIM-' + crypto.randomUUID();
    hold.status = 'confirmed';
    await payment.save({ transaction });
    await hold.save({ transaction });
    return { payment, booking, replayed: false };
  });
}

async function refundPayment({ userId, paymentId }) {
  return sequelize.transaction(async (transaction) => {
    const initial = await Payment.findByPk(paymentId, { transaction });
    if (!initial) throw new HttpError(404, 'Payment intent not found');
    const hold = await SeatHold.findByPk(initial.holdId, { transaction });
    if (!hold) throw new HttpError(404, 'Seat hold not found');
    const show = await Show.findByPk(hold.showId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!show) throw new HttpError(404, 'Show not found');
    const payment = await Payment.findByPk(paymentId, { transaction, lock: transaction.LOCK.UPDATE });
    if (payment.userId !== userId) throw new HttpError(403, 'You can only refund your own payment');
    if (payment.status === 'refunded') return { payment, replayed: true, promotion: null };
    if (payment.status !== 'succeeded' || !payment.bookingId) throw new HttpError(409, 'Only successful payments can be refunded');
    const booking = await Booking.findByPk(payment.bookingId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!booking || booking.status !== 'confirmed') throw new HttpError(409, 'The booking is no longer refundable');
    const seat = await Seat.findByPk(booking.seatId, { transaction, lock: transaction.LOCK.UPDATE });
    booking.status = 'cancelled';
    await booking.save({ transaction });
    const promotion = await waitlistService.promoteNext({ show, seat, transaction });
    payment.status = 'refunded';
    await payment.save({ transaction });
    return { payment, replayed: false, promotion };
  });
}

module.exports = { createIntent, confirmPayment, refundPayment };
