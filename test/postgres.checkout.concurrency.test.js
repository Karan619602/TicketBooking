const test = require('node:test');
const assert = require('node:assert/strict');
require('dotenv').config();

test('PostgreSQL serializes competing seat holds and atomically confirms one payment', {
  skip: !['postgres', 'postgresql'].includes((process.env.DB_DIALECT || '').toLowerCase()) && 'Requires PostgreSQL 16'
}, async () => {
  const { Op } = require('sequelize');
  const { initializeDatabase, sequelize, User, Screen, Show, Seat, Booking, Waitlist, SeatHold, Payment } = require('../models');
  const holdService = require('../services/seatholdservice');
  const paymentService = require('../services/paymentservice');
  const users = [];
  let screen, show, seat;
  try {
    await initializeDatabase();
    for (let i = 0; i < 2; i++) users.push(await User.create({
      name: 'PG Hold User ' + i,
      email: 'pg-hold-' + Date.now() + '-' + i + '@example.test'
    }));
    screen = await Screen.create({ name: 'PG Hold Concurrency Screen', capacity: 1 });
    const now = Date.now();
    show = await Show.create({
      name: 'PG Hold Race Test', screenId: screen.id,
      startTime: new Date(now + 3600000), endTime: new Date(now + 10800000)
    });
    seat = await Seat.create({ number: 1, screenId: screen.id, price: 300 });
    const attempts = await Promise.allSettled(users.map((user) =>
      holdService.createHold({ userId: user.id, showId: show.id, seatId: seat.id })
    ));
    assert.equal(attempts.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal(attempts.filter((result) => result.status === 'rejected').length, 1);
    const winner = attempts.find((result) => result.status === 'fulfilled').value.hold;
    assert.equal(await SeatHold.count({ where: { showId: show.id, seatId: seat.id, status: 'active' } }), 1);

    const intent = await paymentService.createIntent({
      userId: winner.userId, holdId: winner.id, idempotencyKey: 'pg-checkout-' + Date.now()
    });
    const confirmation = await paymentService.confirmPayment({ userId: winner.userId, paymentId: intent.payment.id });
    assert.equal(confirmation.payment.status, 'succeeded');
    assert.equal(confirmation.booking.status, 'confirmed');
    assert.equal(await Booking.count({ where: { showId: show.id, seatId: seat.id, status: 'confirmed' } }), 1);
    await assert.rejects(
      holdService.createHold({ userId: users.find((user) => user.id !== winner.userId).id, showId: show.id, seatId: seat.id }),
      (error) => error.status === 409
    );
  } finally {
    if (show) {
      const holds = await SeatHold.findAll({ where: { showId: show.id }, attributes: ['id'] });
      await Payment.destroy({ where: { holdId: { [Op.in]: holds.map((hold) => hold.id) } } });
      await SeatHold.destroy({ where: { showId: show.id } });
      await Booking.destroy({ where: { showId: show.id } });
      await Waitlist.destroy({ where: { showId: show.id } });
      await Show.destroy({ where: { id: show.id } });
    }
    if (seat) await Seat.destroy({ where: { id: seat.id } });
    if (screen) await Screen.destroy({ where: { id: screen.id } });
    if (users.length) await User.destroy({ where: { id: users.map((user) => user.id) } });
    await sequelize.close();
  }
});
