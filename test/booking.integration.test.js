const test = require('node:test');
const assert = require('node:assert/strict');
require('dotenv').config();

const shouldRun = process.env.RUN_DB_TESTS === 'true';

test('booking flow handles contention, retries, availability and cancellation', {
  skip: !shouldRun && 'Set RUN_DB_TESTS=true and configure a dedicated test database to run integration tests'
}, async () => {
  const { initializeDatabase, sequelize, User, Screen, Show, Seat, Booking } = require('../models');
  const bookingService = require('../services/bookingservice');

  let user;
  let screen;
  let firstShow;
  let secondShow;
  let seat;

  try {
    await initializeDatabase();

    user = await User.create({
      name: 'Booking Test User',
      email: 'booking-test-' + Date.now() + '@example.test'
    });
    screen = await Screen.create({ name: 'Integration Test Screen', capacity: 5 });
    const now = Date.now();
    firstShow = await Show.create({
      name: 'Concurrency Test',
      screenId: screen.id,
      startTime: new Date(now + 60 * 60 * 1000),
      endTime: new Date(now + 3 * 60 * 60 * 1000)
    });
    secondShow = await Show.create({
      name: 'Second Show',
      screenId: screen.id,
      startTime: new Date(now + 4 * 60 * 60 * 1000),
      endTime: new Date(now + 6 * 60 * 60 * 1000)
    });
    seat = await Seat.create({
      number: 1,
      screenId: screen.id,
      category: 'standard',
      price: 180
    });

    const attempts = await Promise.allSettled([
      bookingService.createBooking({
        userId: user.id, showId: firstShow.id, seatId: seat.id, idempotencyKey: 'parallel-request-a'
      }),
      bookingService.createBooking({
        userId: user.id, showId: firstShow.id, seatId: seat.id, idempotencyKey: 'parallel-request-b'
      })
    ]);
    assert.equal(attempts.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal(attempts.filter((result) => result.status === 'rejected').length, 1);

    const firstBooking = attempts.find((result) => result.status === 'fulfilled').value.booking;
    const retry = await bookingService.createBooking({
      userId: user.id, showId: firstShow.id, seatId: seat.id,
      idempotencyKey: firstBooking.idempotencyKey.split(':').slice(1).join(':')
    });
    assert.equal(retry.booking.id, firstBooking.id);
    assert.equal(retry.replayed, true);

    const otherShowBooking = await bookingService.createBooking({
      userId: user.id, showId: secondShow.id, seatId: seat.id, idempotencyKey: 'same-seat-other-show'
    });
    assert.notEqual(otherShowBooking.booking.id, firstBooking.id);

    await bookingService.cancelBooking({ bookingId: firstBooking.id, userId: user.id });
    const replacement = await bookingService.createBooking({
      userId: user.id, showId: firstShow.id, seatId: seat.id, idempotencyKey: 'replacement-after-cancel'
    });
    assert.equal(replacement.booking.status, 'confirmed');

    const history = await Booking.findAll({ where: { userId: user.id }, order: [['id', 'ASC']] });
    assert.equal(history.filter((booking) => booking.status === 'cancelled').length, 1);
    assert.equal(history.filter((booking) => booking.status === 'confirmed').length, 2);
  } finally {
    if (user) {
      await Booking.destroy({ where: { userId: user.id } });
      if (seat) await Seat.destroy({ where: { id: seat.id } });
      if (firstShow) await Show.destroy({ where: { id: firstShow.id } });
      if (secondShow) await Show.destroy({ where: { id: secondShow.id } });
      if (screen) await Screen.destroy({ where: { id: screen.id } });
      await User.destroy({ where: { id: user.id } });
    }
    await sequelize.close();
  }
});
