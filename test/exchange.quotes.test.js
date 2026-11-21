'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createFixture, key, assertHttp } = require('./exchange.helpers');
const { sequelize } = require('../models');

test('exchange quotes reserve a destination without changing the original ticket', async (t) => {
  t.after(async () => sequelize.close());

  await t.test('authorization, missing records and input validation', async () => {
    const f = await createFixture();
    try {
      assertHttp(await f.request('POST', f.quotePath(), { body: f.quoteBody(), idempotencyKey: key('q') }), 401, 'anonymous');
      assertHttp(await f.quote({ token: f.tokens.other }), 403, 'other customer');
      assertHttp(await f.quote({ bookingId: 999999999 }), 404, 'missing booking');
      assertHttp(await f.request('POST', f.quotePath(), {
        token: f.tokens.owner, body: f.quoteBody(), idempotencyKey: undefined
      }), 400, 'missing idempotency key');
      assertHttp(await f.quote({ targetSeatId: -1 }), 400, 'negative seat id');
      assertHttp(await f.quote({ targetShowId: f.oldShow.id, targetSeatId: f.originalSeat.id }), 409, 'same seat');
      const original = await f.Booking.findByPk(f.booking.id);
      assert.equal(original.seatId, f.originalSeat.id);
      assert.equal(original.status, 'confirmed');
    } finally { await f.cleanup(); }
  });

  await t.test('quote uses integer paise and places a five-minute exchange reservation', async () => {
    const f = await createFixture();
    try {
      const response = await f.quote();
      assertHttp(response, 201, 'new quote');
      assert.ok(response.body.quote?.id, 'quote ID must be returned');
      assert.equal(response.body.quote.status, 'quoted');
      assert.equal(response.body.quote.priceDifferencePaise, 10000);
      const expiry = new Date(response.body.quote.expiresAt).getTime();
      assert.ok(expiry > Date.now() + 4 * 60 * 1000, 'expiry is roughly five minutes away');
      assert.ok(expiry <= Date.now() + 6 * 60 * 1000, 'expiry cannot be unbounded');

      const original = await f.Booking.findByPk(f.booking.id);
      assert.equal(original.seatId, f.originalSeat.id);
      assert.equal(original.showId, f.oldShow.id);
      assert.equal((await f.Payment.findByPk(f.payment.id)).bookingId, f.booking.id);

      const hold = await f.request('POST', '/api/v1/shows/' + f.newShow.id + '/holds', {
        token: f.tokens.other, body: { seatId: f.targetSeat.id }
      });
      assertHttp(hold, 409, 'a quoted destination is unavailable to ordinary checkout');
    } finally { await f.cleanup(); }
  });

  await t.test('quote retries replay a persisted result and key misuse conflicts', async () => {
    const f = await createFixture();
    try {
      const idempotencyKey = key('same');
      const first = await f.quote({ idempotencyKey });
      assertHttp(first, 201, 'initial quote');
      const again = await f.quote({ idempotencyKey });
      assertHttp(again, 200, 'same request replay');
      assert.equal(again.body.quote.id, first.body.quote.id);
      assert.equal(again.body.replayed, true);
      assertHttp(await f.quote({ idempotencyKey, targetSeatId: f.cheapSeat.id }), 409, 'changed payload');
      assert.equal(await f.Booking.count({ where: { id: f.booking.id, status: 'confirmed' } }), 1);
    } finally { await f.cleanup(); }
  });

  await t.test('occupied or held seats and mismatched screen are rejected without mutation', async () => {
    const f = await createFixture();
    try {
      await f.Booking.create({
        userId: f.other.id, showId: f.newShow.id, seatId: f.targetSeat.id,
        status: 'confirmed', totalAmount: f.targetSeat.price
      });
      assertHttp(await f.quote(), 409, 'booked destination');
      await f.SeatHold.create({
        userId: f.other.id, showId: f.newShow.id, seatId: f.cheapSeat.id,
        status: 'active', expiresAt: new Date(Date.now() + 300000)
      });
      assertHttp(await f.quote({ targetSeatId: f.cheapSeat.id }), 409, 'held destination');
      assertHttp(await f.quote({ targetSeatId: f.freeOldSeat.id }), 409, 'wrong screen');
      assert.equal((await f.Booking.findByPk(f.booking.id)).seatId, f.originalSeat.id);
    } finally { await f.cleanup(); }
  });

  await t.test('customer cancellation releases only exchange reservation', async () => {
    const f = await createFixture();
    try {
      const response = await f.quote();
      assertHttp(response, 201, 'quote created');
      const quoteId = response.body.quote.id;
      assertHttp(await f.request('DELETE', '/api/v1/booking-exchanges/' + quoteId, { token: f.tokens.other }), 403, 'not owner');
      assertHttp(await f.request('DELETE', '/api/v1/booking-exchanges/' + quoteId, { token: f.tokens.owner }), 200, 'cancel quote');
      const hold = await f.request('POST', '/api/v1/shows/' + f.newShow.id + '/holds', {
        token: f.tokens.other, body: { seatId: f.targetSeat.id }
      });
      assertHttp(hold, 201, 'released seat can now be held');
      assert.equal((await f.Booking.findByPk(f.booking.id)).seatId, f.originalSeat.id);
      assert.equal((await f.Payment.findByPk(f.payment.id)).status, 'succeeded');
    } finally { await f.cleanup(); }
  });
});
