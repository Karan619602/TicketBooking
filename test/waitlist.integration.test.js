const test = require('node:test');
const assert = require('node:assert/strict');
require('dotenv').config();

test('waitlist promotes the oldest eligible user when a confirmed booking is cancelled', async () => {
  const { initializeDatabase, sequelize, User, Screen, Show, Seat, Booking, Waitlist } = require('../models');
  const bookingService = require('../services/bookingservice');
  const waitlistService = require('../services/waitlistservice');
  const users = [];
  let screen, show, seat, original;
  try {
    await initializeDatabase();
    for (let i = 0; i < 3; i++) users.push(await User.create({
      name: 'Waitlist Test ' + i, email: 'waitlist-' + Date.now() + '-' + i + '@example.test'
    }));
    screen = await Screen.create({ name: 'Waitlist Test Screen', capacity: 1 });
    const now = Date.now();
    show = await Show.create({ name: 'Waitlist FIFO Test', screenId: screen.id,
      startTime: new Date(now + 3600000), endTime: new Date(now + 10800000) });
    seat = await Seat.create({ number: 1, screenId: screen.id, price: 200 });
    original = (await bookingService.createBooking({ userId: users[0].id, showId: show.id, seatId: seat.id })).booking;
    const first = await waitlistService.joinWaitlist({ userId: users[1].id, showId: show.id });
    const second = await waitlistService.joinWaitlist({ userId: users[2].id, showId: show.id });
    assert.equal(first.created, true);
    assert.equal(second.created, true);
    await bookingService.cancelBooking({ bookingId: original.id, userId: users[0].id });
    const promoted = await Booking.findOne({ where: { showId: show.id, userId: users[1].id, status: 'confirmed' } });
    assert.ok(promoted);
    assert.equal((await Waitlist.findByPk(first.entry.id)).status, 'promoted');
    assert.equal((await Waitlist.findByPk(first.entry.id)).promotedBookingId, promoted.id);
    assert.equal((await Waitlist.findByPk(second.entry.id)).status, 'waiting');
    await assert.rejects(waitlistService.joinWaitlist({ userId: users[1].id, showId: show.id }), (error) => error.status === 409);
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
