const { Op } = require('sequelize');
const { sequelize, User, Show, Seat, Booking, Waitlist, SeatHold } = require('../models');
const HttpError = require('../utils/httpError');

async function joinWaitlist({ userId, showId }) {
  return sequelize.transaction(async (transaction) => {
    const show = await Show.findByPk(showId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!show) throw new HttpError(404, 'Show not found');
    if (new Date(show.endTime) <= new Date()) throw new HttpError(400, 'This show has already ended');
    const user = await User.findByPk(userId, { transaction });
    if (!user) throw new HttpError(404, 'User not found');
    const existing = await Waitlist.findOne({ where: { userId, showId, status: 'waiting' }, transaction });
    if (existing) return { entry: existing, created: false };
    const seatCount = await Seat.count({ where: { screenId: show.screenId }, transaction });
    const bookedCount = await Booking.count({ where: { showId, status: 'confirmed' }, transaction });
    const activeHoldCount = await SeatHold.count({ where: { showId, status: 'active', expiresAt: { [Op.gt]: new Date() } }, transaction });
    if (seatCount === 0 || bookedCount + activeHoldCount < seatCount) throw new HttpError(409, 'This show still has available seats; book directly instead');
    const alreadyBooked = await Booking.findOne({ where: { userId, showId, status: 'confirmed' }, transaction });
    if (alreadyBooked) throw new HttpError(409, 'You already have a confirmed booking for this show');
    const entry = await Waitlist.create({ userId, showId, status: 'waiting' }, { transaction });
    return { entry, created: true };
  });
}

async function getWaitlist({ showId, userId }) {
  const where = { showId };
  if (userId) where.userId = userId;
  return Waitlist.findAll({ where, order: [['createdAt', 'ASC'], ['id', 'ASC']] });
}

async function leaveWaitlist({ waitlistId, userId }) {
  return sequelize.transaction(async (transaction) => {
    const entry = await Waitlist.findByPk(waitlistId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!entry) throw new HttpError(404, 'Waitlist entry not found');
    if (Number(userId) !== entry.userId) throw new HttpError(403, 'You can only remove your own waitlist entry');
    if (entry.status !== 'waiting') throw new HttpError(409, 'This waitlist entry is no longer active');
    entry.status = 'cancelled';
    await entry.save({ transaction });
    return entry;
  });
}

async function promoteNext({ show, seat, transaction }) {
  const next = await Waitlist.findOne({
    where: { showId: show.id, status: 'waiting' },
    order: [['createdAt', 'ASC'], ['id', 'ASC']],
    transaction, lock: transaction.LOCK.UPDATE
  });
  if (!next) return null;
  const alreadyBooked = await Booking.findOne({
    where: { showId: show.id, userId: next.userId, status: 'confirmed' }, transaction
  });
  if (alreadyBooked) {
    next.status = 'cancelled';
    await next.save({ transaction });
    return promoteNext({ show, seat, transaction });
  }
  const booking = await Booking.create({
    userId: next.userId, showId: show.id, seatId: seat.id,
    status: 'confirmed', totalAmount: seat.price
  }, { transaction });
  next.status = 'promoted';
  next.promotedBookingId = booking.id;
  await next.save({ transaction });
  return { entry: next, booking };
}

module.exports = { joinWaitlist, getWaitlist, leaveWaitlist, promoteNext };
