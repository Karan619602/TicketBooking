const test = require('node:test');
const assert = require('node:assert/strict');
require('dotenv').config();

process.env.DB_DIALECT = 'sqlite';
process.env.DB_STORAGE = ':memory:';
process.env.NODE_ENV = 'test';

test('authenticated checkout holds seats, confirms idempotently and refunds atomically', async () => {
  const models = require('../models');
  const { sequelize, User, Screen, Show, Seat, Booking, Waitlist, Credential, SeatHold, Payment, initializeDatabase } = models;
  const authService = require('../services/authservice');
  const holdService = require('../services/seatholdservice');
  const paymentService = require('../services/paymentservice');
  const { verifyToken } = require('../utils/tokens');
  let screen, show;
  const userIds = [];
  try {
    await initializeDatabase();
    const registered = await authService.register({
      name: 'Checkout Test User',
      email: 'checkout-' + Date.now() + '@example.test',
      password: 'correct-horse-battery-staple'
    });
    userIds.push(registered.user.id);
    assert.equal(verifyToken(registered.accessToken).sub, registered.user.id);
    const login = await authService.login({ email: registered.user.email, password: 'correct-horse-battery-staple' });
    assert.equal(login.user.id, registered.user.id);
    await assert.rejects(
      authService.login({ email: registered.user.email, password: 'incorrect-password' }),
      (error) => error.status === 401
    );

    const secondUser = await authService.register({
      name: 'Other Checkout User',
      email: 'checkout-other-' + Date.now() + '@example.test',
      password: 'another-correct-password'
    });
    userIds.push(secondUser.user.id);

    screen = await Screen.create({ name: 'Checkout Test Screen', capacity: 2 });
    const now = Date.now();
    show = await Show.create({
      name: 'Checkout Lifecycle Test',
      screenId: screen.id,
      startTime: new Date(now + 3600000),
      endTime: new Date(now + 10800000)
    });
    const seat1 = await Seat.create({ number: 1, screenId: screen.id, category: 'standard', price: 250 });
    const seat2 = await Seat.create({ number: 2, screenId: screen.id, category: 'standard', price: 250 });

    const held = await holdService.createHold({ userId: registered.user.id, showId: show.id, seatId: seat1.id });
    assert.equal(held.created, true);
    await assert.rejects(
      holdService.createHold({ userId: secondUser.user.id, showId: show.id, seatId: seat1.id }),
      (error) => error.status === 409
    );
    const bookingService = require('../services/bookingservice');
    await assert.rejects(
      bookingService.createBooking({ userId: secondUser.user.id, showId: show.id, seatId: seat1.id }),
      (error) => error.status === 409
    );

    const intent = await paymentService.createIntent({
      userId: registered.user.id, holdId: held.hold.id, idempotencyKey: 'checkout-intent-' + Date.now()
    });
    assert.equal(intent.payment.status, 'pending');
    const confirmed = await paymentService.confirmPayment({ userId: registered.user.id, paymentId: intent.payment.id });
    assert.equal(confirmed.payment.status, 'succeeded');
    assert.equal(confirmed.booking.status, 'confirmed');
    const replay = await paymentService.confirmPayment({ userId: registered.user.id, paymentId: intent.payment.id });
    assert.equal(replay.replayed, true);
    assert.equal(replay.booking.id, confirmed.booking.id);

    const refunded = await paymentService.refundPayment({ userId: registered.user.id, paymentId: intent.payment.id });
    assert.equal(refunded.payment.status, 'refunded');
    assert.equal((await Booking.findByPk(confirmed.booking.id)).status, 'cancelled');
    const refundReplay = await paymentService.refundPayment({ userId: registered.user.id, paymentId: intent.payment.id });
    assert.equal(refundReplay.replayed, true);

    const releasable = await holdService.createHold({ userId: registered.user.id, showId: show.id, seatId: seat2.id });
    const released = await holdService.releaseHold({ holdId: releasable.hold.id, userId: registered.user.id });
    assert.equal(released.status, 'released');

    const expiring = await holdService.createHold({ userId: registered.user.id, showId: show.id, seatId: seat2.id });
    expiring.hold.expiresAt = new Date(Date.now() - 1000);
    await expiring.hold.save();
    const expired = await holdService.getHold({ holdId: expiring.hold.id, userId: registered.user.id });
    assert.equal(expired.status, 'expired');
    await assert.rejects(
      paymentService.createIntent({ userId: registered.user.id, holdId: expiring.hold.id }),
      (error) => error.status === 409
    );

    assert.equal(await Payment.count({ where: { userId: registered.user.id } }), 1);
    assert.equal(await SeatHold.count({ where: { userId: registered.user.id, status: 'confirmed' } }), 1);
  } finally {
    if (show) {
      await Payment.destroy({ where: { userId: userIds } });
      await SeatHold.destroy({ where: { showId: show.id } });
      await Booking.destroy({ where: { showId: show.id } });
      await Waitlist.destroy({ where: { showId: show.id } });
      await Show.destroy({ where: { id: show.id } });
    }
    if (screen) {
      await Seat.destroy({ where: { screenId: screen.id } });
      await Screen.destroy({ where: { id: screen.id } });
    }
    if (userIds.length) {
      await Credential.destroy({ where: { userId: userIds } });
      await User.destroy({ where: { id: userIds } });
    }
    await sequelize.close();
  }
});
