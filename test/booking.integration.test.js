const test = require("node:test");
const assert = require("node:assert/strict");
require("dotenv").config();

test("SQLite booking flow supports retries, availability and cancellation", async () => {
  const {
    initializeDatabase,
    sequelize,
    User,
    Screen,
    Show,
    Seat,
    Booking,
  } = require("../models");
  const bookingService = require("../services/bookingservice");

  let user;
  let screen;
  let firstShow;
  let secondShow;
  let seat;

  try {
    await initializeDatabase();

    user = await User.create({
      name: "SQLite Booking Test User",
      email: "sqlite-booking-test-" + Date.now() + "@example.test",
    });
    screen = await Screen.create({ name: "SQLite Test Screen", capacity: 5 });
    const now = Date.now();
    firstShow = await Show.create({
      name: "SQLite Functional Test",
      screenId: screen.id,
      startTime: new Date(now + 60 * 60 * 1000),
      endTime: new Date(now + 3 * 60 * 60 * 1000),
    });
    secondShow = await Show.create({
      name: "SQLite Second Show",
      screenId: screen.id,
      startTime: new Date(now + 4 * 60 * 60 * 1000),
      endTime: new Date(now + 6 * 60 * 60 * 1000),
    });
    seat = await Seat.create({
      number: 1,
      screenId: screen.id,
      category: "standard",
      price: 180,
    });

    const firstResult = await bookingService.createBooking({
      userId: user.id,
      showId: firstShow.id,
      seatId: seat.id,
      idempotencyKey: "sqlite-functional-booking",
    });
    assert.equal(firstResult.replayed, false);
    const firstBooking = firstResult.booking;

    const retry = await bookingService.createBooking({
      userId: user.id,
      showId: firstShow.id,
      seatId: seat.id,
      idempotencyKey: "sqlite-functional-booking",
    });
    assert.equal(retry.booking.id, firstBooking.id);
    assert.equal(retry.replayed, true);

    const otherShowBooking = await bookingService.createBooking({
      userId: user.id,
      showId: secondShow.id,
      seatId: seat.id,
      idempotencyKey: "sqlite-same-seat-other-show",
    });
    assert.notEqual(otherShowBooking.booking.id, firstBooking.id);

    await bookingService.cancelBooking({
      bookingId: firstBooking.id,
      userId: user.id,
    });
    const replacement = await bookingService.createBooking({
      userId: user.id,
      showId: firstShow.id,
      seatId: seat.id,
      idempotencyKey: "sqlite-replacement-after-cancel",
    });
    assert.equal(replacement.booking.status, "confirmed");

    const history = await Booking.findAll({
      where: { userId: user.id },
      order: [["id", "ASC"]],
    });
    assert.equal(
      history.filter((booking) => booking.status === "cancelled").length,
      1,
    );
    assert.equal(
      history.filter((booking) => booking.status === "confirmed").length,
      2,
    );
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
