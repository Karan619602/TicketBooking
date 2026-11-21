const test = require('node:test');
const assert = require('node:assert/strict');
require('dotenv').config();

const { initializeDatabase, sequelize, Screen, Show } = require('../models');
const { GetAllShows } = require('../controllers/showcontroller');

let screen;
let otherScreen;
let fixtures = [];

const callCatalog = async (query = {}) => {
  let statusCode;
  let payload;
  let forwardedError;
  const req = { query };
  const res = {
    status(code) { statusCode = code; return this; },
    json(body) { payload = body; return this; }
  };
  await GetAllShows(req, res, (error) => { forwardedError = error; });
  if (forwardedError) {
    statusCode = forwardedError.status || 500;
    payload = { message: forwardedError.message };
  }
  return { statusCode, payload };
};

test.before(async () => {
  await initializeDatabase();
  screen = await Screen.create({ name: 'Catalog Test Screen', capacity: 20, location: 'Test Hall' });
  otherScreen = await Screen.create({ name: 'Catalog Other Screen', capacity: 10, location: 'Test Hall' });
  const base = Date.now() + 24 * 60 * 60 * 1000;
  const rows = [
    { name: 'The Amber Movie', screenId: screen.id, startTime: new Date(base), endTime: new Date(base + 7200000) },
    { name: 'Blue Horizon', screenId: screen.id, startTime: new Date(base + 3 * 3600000), endTime: new Date(base + 5 * 3600000) },
    { name: 'The Amber Returns', screenId: screen.id, startTime: new Date(base + 6 * 3600000), endTime: new Date(base + 8 * 3600000) },
    { name: 'Night Train', screenId: otherScreen.id, startTime: new Date(base + 9 * 3600000), endTime: new Date(base + 11 * 3600000) }
  ];
  for (const row of rows) fixtures.push(await Show.create(row));
});

test('catalog paginates results and returns accurate navigation metadata', async () => {
  const first = await callCatalog({ page: '1', limit: '2' });
  assert.equal(first.statusCode, 200);
  assert.equal(first.payload.shows.length, 2);
  assert.equal(first.payload.pagination.total, 4);
  assert.equal(first.payload.pagination.page, 1);
  assert.equal(first.payload.pagination.limit, 2);
  assert.equal(first.payload.pagination.totalPages, 2);
  assert.equal(first.payload.pagination.hasNextPage, true);
  assert.equal(first.payload.pagination.hasPreviousPage, false);

  const second = await callCatalog({ page: '2', limit: '2' });
  assert.equal(second.payload.shows.length, 2);
  assert.equal(second.payload.pagination.hasNextPage, false);
  assert.equal(second.payload.pagination.hasPreviousPage, true);
});

test('catalog supports case-insensitive name search and existing filters', async () => {
  const search = await callCatalog({ search: 'aMbEr' });
  assert.equal(search.statusCode, 200);
  assert.equal(search.payload.pagination.total, 2);
  assert.deepEqual(search.payload.shows.map((show) => show.name).sort(), [
    'The Amber Movie',
    'The Amber Returns'
  ]);

  const filtered = await callCatalog({
    screenId: String(screen.id),
    from: fixtures[0].startTime.toISOString(),
    to: fixtures[1].startTime.toISOString()
  });
  assert.equal(filtered.payload.pagination.total, 2);
  assert.ok(filtered.payload.shows.every((show) => show.screenId === screen.id));
});

test('catalog supports sorting with deterministic ID tie-breaker', async () => {
  const result = await callCatalog({ sortBy: 'name', sortOrder: 'desc', limit: '10' });
  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.payload.shows.map((show) => show.name), [
    'The Amber Returns',
    'The Amber Movie',
    'Night Train',
    'Blue Horizon'
  ]);
});

test('catalog rejects invalid pagination, search, date and sorting parameters', async (t) => {
  const invalidQueries = [
    [{ page: '0' }, /page must be a positive integer/],
    [{ limit: '101' }, /limit must be between 1 and 100/],
    [{ screenId: 'abc' }, /screenId must be a positive integer/],
    [{ search: 'x'.repeat(101) }, /search must be 100 characters or fewer/],
    [{ from: 'not-a-date' }, /Invalid from date/],
    [{ from: '2027-01-02', to: '2027-01-01' }, /from must be earlier/],
    [{ sortBy: 'unknown' }, /sortBy must be one of/],
    [{ sortOrder: 'sideways' }, /sortOrder must be asc or desc/]
  ];

  for (const [query, expectedMessage] of invalidQueries) {
    await t.test(JSON.stringify(query), async () => {
      const result = await callCatalog(query);
      assert.equal(result.statusCode, 400);
      assert.match(result.payload.message, expectedMessage);
    });
  }
});

test.after(async () => {
  if (fixtures.length) await Show.destroy({ where: { id: fixtures.map((show) => show.id) } });
  if (screen) await Screen.destroy({ where: { id: screen.id } });
  if (otherScreen) await Screen.destroy({ where: { id: otherScreen.id } });
  await sequelize.close();
});
