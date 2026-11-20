const { Op } = require('sequelize');
const { sequelize, Show, Seat, Booking, SeatHold } = require('../models');
const HttpError = require('../utils/httpError');

const HOLD_MINUTES = Math.min(Math.max(Number(process.env.SEAT_HOLD_MINUTES) || 5, 1), 15);

async function createHold({ userId, showId, seatId }) {
  try {
    return await sequelize.transaction(async (transaction) => {
      const show = await Show.findByPk(showId, { transaction, lock: transaction.LOCK.UPDATE });
      if (!show) throw new HttpError(404, 'Show not found');
      if (new Date(show.endTime) <= new Date()) throw new HttpError(400, 'This show has already ended');
      const seat = await Seat.findOne({ where: { id: seatId, screenId: show.screenId }, transaction, lock: transaction.LOCK.UPDATE });
      if (!seat) throw new HttpError(404, 'Seat not found for this show');
      const booked = await Booking.findOne({ where: { showId, seatId, status: 'confirmed' }, transaction });
      if (booked) throw new HttpError(409, 'This seat is already booked for the selected show');

      const now = new Date();
      await SeatHold.update({ status: 'expired' }, {
        where: { showId, seatId, status: 'active', expiresAt: { [Op.lte]: now } }, transaction
      });
      const active = await SeatHold.findOne({
        where: { showId, seatId, status: 'active', expiresAt: { [Op.gt]: now } },
        transaction, lock: transaction.LOCK.UPDATE
      });
      if (active) {
        if (active.userId === userId) return { hold: active, created: false };
        throw new HttpError(409, 'This seat is temporarily held by another user');
      }
      const hold = await SeatHold.create({
        userId, showId, seatId, status: 'active',
        expiresAt: new Date(now.getTime() + HOLD_MINUTES * 60 * 1000)
      }, { transaction });
      return { hold, created: true };
    });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') throw new HttpError(409, 'This seat is already held by another user');
    throw error;
  }
}

async function getHold({ holdId, userId }) {
  const hold = await SeatHold.findByPk(holdId);
  if (!hold) throw new HttpError(404, 'Seat hold not found');
  if (hold.userId !== userId) throw new HttpError(403, 'You can only view your own seat holds');
  if (hold.status === 'active' && new Date(hold.expiresAt) <= new Date()) {
    hold.status = 'expired';
    await hold.save();
  }
  return hold;
}

async function releaseHold({ holdId, userId }) {
  return sequelize.transaction(async (transaction) => {
    const initial = await SeatHold.findByPk(holdId, { transaction });
    if (!initial) throw new HttpError(404, 'Seat hold not found');
    const show = await Show.findByPk(initial.showId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!show) throw new HttpError(404, 'Show not found');
    const hold = await SeatHold.findByPk(holdId, { transaction, lock: transaction.LOCK.UPDATE });
    if (hold.userId !== userId) throw new HttpError(403, 'You can only release your own seat holds');
    if (hold.status !== 'active') throw new HttpError(409, 'This seat hold is no longer active');
    hold.status = new Date(hold.expiresAt) <= new Date() ? 'expired' : 'released';
    await hold.save({ transaction });
    return hold;
  });
}

module.exports = { createHold, getHold, releaseHold };
