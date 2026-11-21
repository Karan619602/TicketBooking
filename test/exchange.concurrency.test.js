'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createFixture, key, assertHttp } = require('./exchange.helpers');
const { sequelize } = require('../models');

async function withFixture(work) {
  const f = await createFixture();
  try { await work(f); } finally { await f.cleanup(); }
}

test('exchange concurrency and expiry do not oversell or corrupt existing bookings', async (t) => {
  t.after(async () => sequelize.close());

  await t.test('two quote requests racing for the same destination reserve it only once', async () => {
    await withFixture(async (f) => {
      const secondBooking = await f.Booking.create({
        userId: f.other.id, showId: f.oldShow.id, seatId: f.otherOriginalSeat.id,
        status: 'confirmed', totalAmount: f.otherOriginalSeat.price
      });
      const [a, b] = await Promise.all([
        f.quote({ idempotencyKey: key('a') }),
        f.quote({ bookingId: secondBooking.id, token: f.tokens.other, idempotencyKey: key('b') })
      ]);
      assert.deepEqual([a.status, b.status].sort(), [201, 409], 'exactly one quote reserves destination');
      assert.equal((await f.Booking.findByPk(f.booking.id)).seatId, f.originalSeat.id);
      assert.equal((await f.Booking.findByPk(secondBooking.id)).seatId, f.otherOriginalSeat.id);
      const active = await f.SeatHold.count({
        where: { showId: f.newShow.id, seatId: f.targetSeat.id, status: 'active' }
      });
      assert.equal(active, 1);
    });
  });

  await t.test('concurrent confirmation retries post one adjustment and move one booking', async () => {
    await withFixture(async (f) => {
      const q = await f.quote();
      assertHttp(q, 201, 'quote');
      const idempotencyKey = key('race-confirm');
      const [a, b] = await Promise.all([
        f.confirm(q.body.quote.id, { idempotencyKey }),
        f.confirm(q.body.quote.id, { idempotencyKey })
      ]);
      assert.equal(a.status, 200, JSON.stringify(a.body));
      assert.equal(b.status, 200, JSON.stringify(b.body));
      assert.equal(a.body.booking.id, f.booking.id);
      assert.equal(b.body.booking.id, f.booking.id);
      assert.equal(await sequelize.models.ExchangeAdjustment.count({
        where: { quoteId: q.body.quote.id }
      }), 1);
      assert.equal(await f.Booking.count({
        where: { showId: f.newShow.id, seatId: f.targetSeat.id, status: 'confirmed' }
      }), 1);
    });
  });

  await t.test('cross-show exchanges in opposite lock order finish with no deadlock', async () => {
    await withFixture(async (f) => {
      const secondBooking = await f.Booking.create({
        userId: f.other.id, showId: f.newShow.id, seatId: f.targetOtherSeat.id,
        status: 'confirmed', totalAmount: f.targetOtherSeat.price
      });
      const quoteA = await f.quote({ targetSeatId: f.samePriceSeat.id });
      const quoteB = await f.quote({
        bookingId: secondBooking.id, token: f.tokens.other,
        targetShowId: f.oldShow.id, targetSeatId: f.freeOldSeat.id
      });
      assertHttp(quoteA, 201, 'forward exchange');
      assertHttp(quoteB, 201, 'backward exchange');
      const [a, b] = await Promise.all([
        f.confirm(quoteA.body.quote.id),
        f.confirm(quoteB.body.quote.id, { token: f.tokens.other })
      ]);
      assertHttp(a, 200, 'forward confirm');
      assertHttp(b, 200, 'backward confirm');
      assert.equal((await f.Booking.findByPk(f.booking.id)).seatId, f.samePriceSeat.id);
      assert.equal((await f.Booking.findByPk(secondBooking.id)).seatId, f.freeOldSeat.id);
      assert.equal(await f.Booking.count({
        where: { showId: f.oldShow.id, seatId: f.freeOldSeat.id, status: 'confirmed' }
      }), 1);
    });
  });

  await t.test('expiry closes the quote, frees target hold and leaves original untouched', async () => {
    await withFixture(async (f) => {
      const q = await f.quote();
      assertHttp(q, 201, 'quote');
      const model = sequelize.models.ExchangeQuote;
      assert.ok(model, 'exchange quote must be persisted');
      await model.update({ expiresAt: new Date(Date.now() - 1000) }, {
        where: { id: q.body.quote.id }
      });
      const { expireExchangeQuotes } = require('../services/exchangeservice');
      const first = await expireExchangeQuotes();
      assert.ok(Number(first) >= 0 || typeof first === 'object');
      await expireExchangeQuotes();
      const expired = await model.findByPk(q.body.quote.id);
      assert.equal(expired.status, 'expired');
      assertHttp(await f.confirm(q.body.quote.id), 409, 'expired cannot settle');
      assert.equal((await f.Booking.findByPk(f.booking.id)).seatId, f.originalSeat.id);
      const hold = await f.request('POST', '/api/v1/shows/' + f.newShow.id + '/holds', {
        token: f.tokens.other, body: { seatId: f.targetSeat.id }
      });
      assertHttp(hold, 201, 'destination released by expiry');
    });
  });
});
