'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createFixture, key, assertHttp } = require('./exchange.helpers');
const { sequelize } = require('../models');

async function withFixture(work) {
  const f = await createFixture();
  try { await work(f); } finally { await f.cleanup(); }
}

test('exchange settlement preserves ticket identity and settles adjustments once', async (t) => {
  t.after(async () => sequelize.close());

  await t.test('higher-price exchange posts one charge, moves original booking and promotes FIFO waiter', async () => {
    await withFixture(async (f) => {
      const waiting = await f.Waitlist.create({
        userId: f.waiter.id, showId: f.oldShow.id, status: 'waiting'
      });
      const q = await f.quote();
      assertHttp(q, 201, 'quote');
      const result = await f.confirm(q.body.quote.id);
      assertHttp(result, 200, 'confirm');
      assert.equal(result.body.booking.id, f.booking.id);
      assert.equal(result.body.booking.showId, f.newShow.id);
      assert.equal(result.body.booking.seatId, f.targetSeat.id);

      const booking = await f.Booking.findByPk(f.booking.id);
      assert.equal(booking.status, 'confirmed');
      assert.equal(booking.userId, f.owner.id);
      assert.equal(booking.showId, f.newShow.id);
      assert.equal(booking.seatId, f.targetSeat.id);
      assert.equal((await f.Payment.findByPk(f.payment.id)).bookingId, f.booking.id);
      assert.equal((await f.Payment.findByPk(f.payment.id)).status, 'succeeded');
      const promoted = await f.Booking.findOne({
        where: { userId: f.waiter.id, showId: f.oldShow.id, seatId: f.originalSeat.id, status: 'confirmed' }
      });
      assert.ok(promoted, 'old seat goes to the earliest eligible waiting customer');
      const entry = await f.Waitlist.findByPk(waiting.id);
      assert.equal(entry.status, 'promoted');
      assert.equal(entry.promotedBookingId, promoted.id);
      const adjustment = sequelize.models.ExchangeAdjustment;
      assert.ok(adjustment, 'persistent adjustment model is required');
      const rows = await adjustment.findAll({ where: { quoteId: q.body.quote.id } });
      assert.equal(rows.length, 1);
      assert.equal(rows[0].direction, 'charge');
      assert.equal(Number(rows[0].amountPaise), 10000);
    });
  });

  await t.test('lower-price exchange records one credit and zero-difference exchange needs no adjustment', async () => {
    await withFixture(async (f) => {
      const q = await f.quote({ targetSeatId: f.cheapSeat.id });
      assertHttp(q, 201, 'cheaper quote');
      assert.equal(q.body.quote.priceDifferencePaise, -10000);
      assertHttp(await f.confirm(q.body.quote.id), 200, 'cheaper confirm');
      const adjustment = sequelize.models.ExchangeAdjustment;
      const credit = await adjustment.findAll({ where: { quoteId: q.body.quote.id } });
      assert.equal(credit.length, 1);
      assert.equal(credit[0].direction, 'credit');
      assert.equal(Number(credit[0].amountPaise), 10000);
    });
    await withFixture(async (f) => {
      const q = await f.quote({ targetSeatId: f.samePriceSeat.id });
      assertHttp(q, 201, 'equal-price quote');
      assert.equal(q.body.quote.priceDifferencePaise, 0);
      assertHttp(await f.confirm(q.body.quote.id), 200, 'equal-price confirm');
      const adjustment = sequelize.models.ExchangeAdjustment;
      assert.equal(await adjustment.count({ where: { quoteId: q.body.quote.id } }), 0);
    });
  });

  await t.test('confirmation replay survives another request, never posts twice', async () => {
    await withFixture(async (f) => {
      const q = await f.quote();
      assertHttp(q, 201, 'quote');
      const idempotencyKey = key('confirm-replay');
      const first = await f.confirm(q.body.quote.id, { idempotencyKey });
      assertHttp(first, 200, 'first confirmation');
      const replay = await f.confirm(q.body.quote.id, { idempotencyKey });
      assertHttp(replay, 200, 'replay confirmation');
      assert.equal(replay.body.replayed, true);
      assert.equal(replay.body.booking.id, first.body.booking.id);
      assert.equal(await sequelize.models.ExchangeAdjustment.count({ where: { quoteId: q.body.quote.id } }), 1);
      assert.equal(await f.Booking.count({ where: { userId: f.owner.id, status: 'confirmed' } }), 1);
    });
  });

  await t.test('definitive decline does not move booking or promote waitlist', async () => {
    await withFixture(async (f) => {
      const q = await f.quote();
      assertHttp(q, 201, 'quote');
      await f.Waitlist.create({ userId: f.waiter.id, showId: f.oldShow.id, status: 'waiting' });
      const prior = process.env.EXCHANGE_SIMULATOR_OUTCOME;
      process.env.EXCHANGE_SIMULATOR_OUTCOME = 'decline';
      let result;
      try { result = await f.confirm(q.body.quote.id); }
      finally {
        if (prior === undefined) delete process.env.EXCHANGE_SIMULATOR_OUTCOME;
        else process.env.EXCHANGE_SIMULATOR_OUTCOME = prior;
      }
      assertHttp(result, 402, 'simulated decline');
      assert.equal((await f.Booking.findByPk(f.booking.id)).seatId, f.originalSeat.id);
      assert.equal((await f.Payment.findByPk(f.payment.id)).status, 'succeeded');
      assert.equal(await f.Booking.count({ where: { userId: f.waiter.id, status: 'confirmed' } }), 0);
      assert.equal(await sequelize.models.ExchangeAdjustment.count({ where: { quoteId: q.body.quote.id } }), 0);
    });
  });

  await t.test('transient failure is retryable and price drift is rejected', async () => {
    await withFixture(async (f) => {
      const q = await f.quote();
      assertHttp(q, 201, 'quote');
      const prior = process.env.EXCHANGE_SIMULATOR_OUTCOME;
      process.env.EXCHANGE_SIMULATOR_OUTCOME = 'transient';
      let transient;
      const retryKey = key('transient');
      try { transient = await f.confirm(q.body.quote.id, { idempotencyKey: retryKey }); }
      finally {
        if (prior === undefined) delete process.env.EXCHANGE_SIMULATOR_OUTCOME;
        else process.env.EXCHANGE_SIMULATOR_OUTCOME = prior;
      }
      assertHttp(transient, 503, 'transient adapter failure');
      assert.equal((await f.Booking.findByPk(f.booking.id)).seatId, f.originalSeat.id);
      const retry = await f.confirm(q.body.quote.id, { idempotencyKey: retryKey });
      assertHttp(retry, 200, 'retry after transient failure');
      assert.equal(await sequelize.models.ExchangeAdjustment.count({ where: { quoteId: q.body.quote.id } }), 1);
    });
    await withFixture(async (f) => {
      const q = await f.quote();
      assertHttp(q, 201, 'quote');
      await f.targetSeat.update({ price: 351 });
      assertHttp(await f.confirm(q.body.quote.id), 409, 'changed destination price');
      assert.equal((await f.Booking.findByPk(f.booking.id)).seatId, f.originalSeat.id);
    });
  });

  await t.test('exchange history belongs to customer, with admin read access', async () => {
    await withFixture(async (f) => {
      const before = await f.request('GET', '/api/v1/bookings/' + f.booking.id + '/exchanges', {
        token: f.tokens.owner
      });
      assertHttp(before, 200, 'history before exchange');
      assert.deepEqual(before.body.exchanges, []);
      const q = await f.quote();
      assertHttp(q, 201, 'quote');
      assertHttp(await f.confirm(q.body.quote.id), 200, 'confirm');
      const path = '/api/v1/bookings/' + f.booking.id + '/exchanges';
      assertHttp(await f.request('GET', path), 401, 'anonymous history');
      assertHttp(await f.request('GET', path, { token: f.tokens.other }), 403, 'other customer history');
      const admin = await f.request('GET', path, { token: f.tokens.admin });
      assertHttp(admin, 200, 'administrator history');
      assert.equal(admin.body.exchanges.length, 1);
      const visible = JSON.stringify(admin.body.exchanges);
      assert.equal(visible.includes('passwordHash'), false);
      assert.equal(visible.includes('passwordSalt'), false);
    });
  });
});
