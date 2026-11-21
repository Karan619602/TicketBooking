'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
require('dotenv').config();

const models = require('../models');
const app = require('../index');
const { signToken } = require('../utils/tokens');

const {
  initializeDatabase, sequelize, User, Credential, Screen, Show, Seat,
  Booking, Waitlist, SeatHold, Payment
} = models;

function key(prefix) {
  return prefix + '-' + crypto.randomUUID();
}

async function createFixture() {
  await initializeDatabase();
  const suffix = crypto.randomUUID();
  const users = [];
  const screens = [];
  const shows = [];
  const seats = [];
  let server;

  async function user(role, label) {
    const record = await User.create({
      name: label + ' Exchange Test',
      email: label.toLowerCase().replace(/\s/g, '-') + '-' + suffix + '@example.test'
    });
    users.push(record);
    await Credential.create({
      userId: record.id,
      role,
      passwordHash: 'a'.repeat(128),
      passwordSalt: 'b'.repeat(64)
    });
    return record;
  }

  const owner = await user('customer', 'Owner');
  const other = await user('customer', 'Other');
  const waiter = await user('customer', 'Waiter');
  const admin = await user('admin', 'Admin');
  const oldScreen = await Screen.create({ name: 'Exchange Original ' + suffix, capacity: 5 });
  const newScreen = await Screen.create({ name: 'Exchange Target ' + suffix, capacity: 5 });
  screens.push(oldScreen, newScreen);
  const start = Date.now() + 5 * 3600000;
  const oldShow = await Show.create({
    name: 'Original Show ' + suffix, screenId: oldScreen.id,
    startTime: new Date(start), endTime: new Date(start + 7200000)
  });
  const newShow = await Show.create({
    name: 'Target Show ' + suffix, screenId: newScreen.id,
    startTime: new Date(start + 9 * 3600000), endTime: new Date(start + 11 * 3600000)
  });
  shows.push(oldShow, newShow);
  async function seat(screen, number, price) {
    const value = await Seat.create({ screenId: screen.id, number, price, category: 'standard' });
    seats.push(value);
    return value;
  }
  const originalSeat = await seat(oldScreen, 1, 250);
  const otherOriginalSeat = await seat(oldScreen, 2, 250);
  const freeOldSeat = await seat(oldScreen, 3, 250);
  const targetSeat = await seat(newScreen, 1, 350);
  const cheapSeat = await seat(newScreen, 2, 150);
  const samePriceSeat = await seat(newScreen, 3, 250);
  const targetOtherSeat = await seat(newScreen, 4, 250);

  const booking = await Booking.create({
    userId: owner.id, showId: oldShow.id, seatId: originalSeat.id,
    totalAmount: originalSeat.price, status: 'confirmed'
  });
  const originalHold = await SeatHold.create({
    userId: owner.id, showId: oldShow.id, seatId: originalSeat.id,
    status: 'confirmed', expiresAt: new Date(Date.now() + 60000)
  });
  const payment = await Payment.create({
    userId: owner.id, holdId: originalHold.id, bookingId: booking.id,
    amount: originalSeat.price, currency: 'INR', status: 'succeeded',
    providerReference: key('SIM')
  });
  const tokens = {
    owner: signToken({ sub: owner.id, role: 'customer' }),
    other: signToken({ sub: other.id, role: 'customer' }),
    waiter: signToken({ sub: waiter.id, role: 'customer' }),
    admin: signToken({ sub: admin.id, role: 'admin' })
  };
  server = app.listen(0);
  await new Promise((resolve, reject) => {
    if (server.listening) return resolve();
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const baseUrl = 'http://127.0.0.1:' + server.address().port;

  async function request(method, path, { token, body, idempotencyKey } = {}) {
    const headers = {};
    if (token) headers.Authorization = 'Bearer ' + token;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
    const res = await fetch(baseUrl + path, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15000)
    });
    const raw = await res.text();
    let payload;
    try { payload = JSON.parse(raw); } catch { payload = { raw }; }
    return { status: res.status, body: payload };
  }

  function quotePath(bookingId = booking.id) {
    return '/api/v1/bookings/' + bookingId + '/exchange-quotes';
  }
  function quoteBody(targetShowId = newShow.id, targetSeatId = targetSeat.id) {
    return { targetShowId, targetSeatId };
  }
  async function quote({ bookingId = booking.id, token = tokens.owner, targetShowId = newShow.id,
    targetSeatId = targetSeat.id, idempotencyKey = key('quote') } = {}) {
    return request('POST', quotePath(bookingId), {
      token, body: quoteBody(targetShowId, targetSeatId), idempotencyKey
    });
  }
  async function confirm(quoteId, { token = tokens.owner, idempotencyKey = key('confirm') } = {}) {
    return request('POST', '/api/v1/booking-exchanges/' + quoteId + '/confirm', {
      token, idempotencyKey, body: {}
    });
  }

  async function cleanup({ closeDb = false } = {}) {
    if (server) await new Promise((resolve, reject) => server.close(e => e ? reject(e) : resolve()));
    const userIds = users.map(u => u.id);
    const showIds = shows.map(s => s.id);
    const modelNames = ['EmailOutbox', 'ExchangeEmailOutbox', 'ExchangeAdjustment', 'ExchangeQuote'];
    for (const name of modelNames) {
      const model = sequelize.models[name];
      if (model && model.rawAttributes.userId) await model.destroy({ where: { userId: userIds } });
    }
    await Payment.destroy({ where: { userId: userIds } });
    await SeatHold.destroy({ where: { showId: showIds } });
    await Booking.destroy({ where: { showId: showIds } });
    await Waitlist.destroy({ where: { showId: showIds } });
    await Show.destroy({ where: { id: showIds } });
    await Seat.destroy({ where: { screenId: screens.map(s => s.id) } });
    await Screen.destroy({ where: { id: screens.map(s => s.id) } });
    await Credential.destroy({ where: { userId: userIds } });
    await User.destroy({ where: { id: userIds } });
    if (closeDb) await sequelize.close();
  }

  return {
    ...models, owner, other, waiter, admin, tokens, oldScreen, newScreen,
    oldShow, newShow, originalSeat, otherOriginalSeat, freeOldSeat, targetSeat,
    cheapSeat, samePriceSeat, targetOtherSeat, booking, payment, request,
    quote, confirm, quotePath, quoteBody, cleanup, key
  };
}

function assertHttp(response, expected, label) {
  assert.equal(response.status, expected, label + ': ' + JSON.stringify(response.body));
}

module.exports = { createFixture, key, assertHttp };
