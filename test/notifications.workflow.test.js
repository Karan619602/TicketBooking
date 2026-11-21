'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createFixture, key, assertHttp } = require('./exchange.helpers');
const { sequelize } = require('../models');
const bookingService = require('../services/bookingservice');
const paymentService = require('../services/paymentservice');
const holdService = require('../services/seatholdservice');

async function withFixture(work) {
  const f = await createFixture();
  try { await work(f); } finally { await f.cleanup(); }
}

function outbox() {
  const model = sequelize.models.EmailOutbox;
  assert.ok(model, 'a persistent EmailOutbox Sequelize model is required');
  return model;
}

async function expectEvent(userId, eventType, count = 1) {
  const rows = await outbox().findAll({ where: { userId, eventType } });
  assert.equal(rows.length, count, eventType + ' should create exactly ' + count + ' outbox record(s)');
  for (const row of rows) {
    assert.equal(row.recipientEmail.endsWith('@example.test'), true);
    assert.ok(['pending', 'sent', 'failed'].includes(row.status));
    assert.equal(JSON.stringify(row).includes('passwordHash'), false);
    assert.equal(JSON.stringify(row).includes('passwordSalt'), false);
  }
  return rows;
}

test('booking, payment, waitlist, hold and exchange transitions enqueue reliable email', async (t) => {
  t.after(async () => sequelize.close());

  await t.test('booking creation and cancellation each enqueue one event', async () => {
    await withFixture(async (f) => {
      const created = await bookingService.createBooking({
        userId: f.other.id, showId: f.oldShow.id, seatId: f.freeOldSeat.id
      });
      assert.equal(created.booking.status, 'confirmed');
      await expectEvent(f.other.id, 'booking.confirmed');
      await bookingService.cancelBooking({ bookingId: created.booking.id, userId: f.other.id });
      await expectEvent(f.other.id, 'booking.cancelled');
    });
  });

  await t.test('waitlist promotion and payment refund produce independent events', async () => {
    await withFixture(async (f) => {
      await f.Waitlist.create({ userId: f.waiter.id, showId: f.oldShow.id, status: 'waiting' });
      const result = await paymentService.refundPayment({
        userId: f.owner.id, paymentId: f.payment.id
      });
      assert.equal(result.payment.status, 'refunded');
      await expectEvent(f.owner.id, 'payment.refunded');
      await expectEvent(f.waiter.id, 'waitlist.promoted');
      await paymentService.refundPayment({ userId: f.owner.id, paymentId: f.payment.id });
      await expectEvent(f.owner.id, 'payment.refunded', 1);
      await expectEvent(f.waiter.id, 'waitlist.promoted', 1);
    });
  });

  await t.test('declined payment and expired hold each enqueue a user-specific event', async () => {
    await withFixture(async (f) => {
      const h = await holdService.createHold({
        userId: f.other.id, showId: f.newShow.id, seatId: f.cheapSeat.id
      });
      const intent = await paymentService.createIntent({
        userId: f.other.id, holdId: h.hold.id, idempotencyKey: key('decline')
      });
      const previous = process.env.PAYMENT_SIMULATOR_OUTCOME;
      process.env.PAYMENT_SIMULATOR_OUTCOME = 'decline';
      try {
        const result = await paymentService.confirmPayment({
          userId: f.other.id, paymentId: intent.payment.id
        });
        assert.equal(result.payment.status, 'failed');
      } finally {
        if (previous === undefined) delete process.env.PAYMENT_SIMULATOR_OUTCOME;
        else process.env.PAYMENT_SIMULATOR_OUTCOME = previous;
      }
      await expectEvent(f.other.id, 'payment.failed');

      const expiring = await holdService.createHold({
        userId: f.waiter.id, showId: f.newShow.id, seatId: f.samePriceSeat.id
      });
      await expiring.hold.update({ expiresAt: new Date(Date.now() - 1000) });
      await holdService.getHold({ holdId: expiring.hold.id, userId: f.waiter.id });
      await expectEvent(f.waiter.id, 'hold.expired');
    });
  });

  await t.test('exchange completion enqueues one email after final settlement', async () => {
    await withFixture(async (f) => {
      const quote = await f.quote();
      assertHttp(quote, 201, 'quote');
      const idempotencyKey = key('confirm');
      assertHttp(await f.confirm(quote.body.quote.id, { idempotencyKey }), 200, 'confirm');
      assertHttp(await f.confirm(quote.body.quote.id, { idempotencyKey }), 200, 'replay');
      const rows = await expectEvent(f.owner.id, 'exchange.confirmed');
      assert.equal(rows.length, 1);
      const serialized = JSON.stringify(rows[0].payload);
      assert.ok(serialized.includes(String(f.oldShow.id)), 'message carries original show information');
      assert.ok(serialized.includes(String(f.newShow.id)), 'message carries target show information');
    });
  });

  await t.test('offline delivery is idempotent and retries transient errors', async () => {
    await withFixture(async (f) => {
      const created = await bookingService.createBooking({
        userId: f.other.id, showId: f.oldShow.id, seatId: f.freeOldSeat.id
      });
      assert.equal(created.booking.status, 'confirmed');
      const [initial] = await expectEvent(f.other.id, 'booking.confirmed');
      const { processEmailOutbox } = require('../services/exchangeemailservice');
      const previous = process.env.EMAIL_SIMULATOR_OUTCOME;
      process.env.EMAIL_SIMULATOR_OUTCOME = 'transient';
      try {
        await processEmailOutbox({ batchSize: 10 });
      } finally {
        if (previous === undefined) delete process.env.EMAIL_SIMULATOR_OUTCOME;
        else process.env.EMAIL_SIMULATOR_OUTCOME = previous;
      }
      const afterFirst = await outbox().findByPk(initial.id);
      assert.equal(afterFirst.status, 'pending');
      assert.ok(afterFirst.attempts >= 1);
      await afterFirst.update({ nextAttemptAt: new Date(Date.now() - 1000) });
      await processEmailOutbox({ batchSize: 10 });
      const sent = await outbox().findByPk(initial.id);
      assert.equal(sent.status, 'sent');
      const attempts = sent.attempts;
      await processEmailOutbox({ batchSize: 10 });
      assert.equal((await outbox().findByPk(initial.id)).attempts, attempts);
      await expectEvent(f.other.id, 'booking.confirmed', 1);
    });
  });
});
