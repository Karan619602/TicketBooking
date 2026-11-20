const test = require('node:test');
const assert = require('node:assert/strict');
require('dotenv').config();

test('PostgreSQL 16 concurrent booking attempts allow one winner and cancellation promotes FIFO waitlist', {
  skip: !['postgres', 'postgresql'].includes((process.env.DB_DIALECT || '').toLowerCase()) && 'Set DB_DIALECT=postgres to run PostgreSQL 16 integration tests'
}, async () => {
  const { initializeDatabase, sequelize, User, Screen, Show, Seat, Booking, Waitlist } = require('../models');
  const bookingService = require('../services/bookingservice');
  const waitlistService = require('../services/waitlistservice');
  const users = [];
  let screen, show, seat;
  try {
    await initializeDatabase();
    for (let i = 0; i < 3; i++) users.push(await User.create({
      name: 'Postgres Test ' + i, email: 'pg-test-' + Date.now() + '-' + i + '@example.test'
    }));
    screen = await Screen.create({ name: 'Postgres Concurrency Screen', capacity: 1 });
    const now = Date.now();
    show = await Show.create({ name: 'Postgres 16 Concurrency', screenId: screen.id,
      startTime: new Date(now + 3600000), endTime: new Date(now + 10800000) });
    seat = await Seat.create({ number: 1, screenId: screen.id, price: 180 });
    const attempts = await Promise.allSettled([
      bookingService.createBooking({ userId: users[0].id, showId: show.id, seatId: seat.id, idempotencyKey: 'pg-a-' + Date.now() }),
      bookingService.createBooking({ userId: users[1].id, showId: show.id, seatId: seat.id, idempotencyKey: 'pg-b-' + Date.now() })
    ]);
    assert.equal(attempts.filter((r) => r.status === 'fulfilled').length, 1);
    assert.equal(attempts.filter((r) => r.status === 'rejected').length, 1);
    const winner = attempts.find((r) => r.status === 'fulfilled').value.booking;
    const loser = users.find((u) => u.id !== winner.userId);
    const queued = await waitlistService.joinWaitlist({ userId: loser.id, showId: show.id });
    await bookingService.cancelBooking({ bookingId: winner.id, userId: winner.id && winner.userId });
    const promoted = await Booking.findOne({ where: { showId: show.id, userId: loser.id, status: 'confirmed' } });
    assert.ok(promoted);
    assert.equal((await Waitlist.findByPk(queued.entry.id)).status, 'promoted');
  } finally {
    if (show) {
      await Booking.destroy({ where: { showId: show.id } });
      await Waitlist.destroy({ where: { showId: show.id } });
      await Show.destroy({ where: { id: show.id } });
    }
    if (seat) await Seat.destroy({ where: { id: seat.id } });
    if (screen) await Screen.destroy({ where: { id: screen.id } });
    if (users.length) await User.destroy({ where: { id: users.map((u) => u.id) } });
    await sequelize.close();
  }
});
