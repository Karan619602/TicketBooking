const { spawnSync } = require('node:child_process');

const dialect = (process.argv[2] || 'sqlite').toLowerCase();
const suites = {
  sqlite: [
    'test/booking.integration.test.js',
    'test/waitlist.integration.test.js',
    'test/checkout.workflow.test.js',
    'test/show.catalog.test.js'
  ],
  postgres: [
    'test/waitlist.integration.test.js',
    'test/postgres.concurrency.test.js',
    'test/postgres.checkout.concurrency.test.js',
    'test/show.catalog.test.js'
  ],
  postgresql: [
    'test/waitlist.integration.test.js',
    'test/postgres.concurrency.test.js',
    'test/postgres.checkout.concurrency.test.js'
  ]
};

if (!suites[dialect]) {
  console.error('Usage: node scripts/run-tests.js [sqlite|postgres]');
  process.exit(2);
}

const result = spawnSync(process.execPath, ['--test', '--test-concurrency=1', ...suites[dialect]], {
  stdio: 'inherit',
  env: { ...process.env, DB_DIALECT: dialect === 'postgresql' ? 'postgres' : dialect }
});
process.exit(result.status === null ? 1 : result.status);
