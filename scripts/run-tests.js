const { spawnSync } = require("node:child_process");

const dialect = (process.argv[2] || "postgres").toLowerCase();

const suites = {
  postgres: [
    "test/booking.integration.test.js",
    "test/waitlist.integration.test.js",
    "test/checkout.workflow.test.js",
    "test/postgres.concurrency.test.js",
    "test/postgres.checkout.concurrency.test.js",
    "test/show.catalog.test.js",
  ],
  postgresql: [
    "test/booking.integration.test.js",
    "test/waitlist.integration.test.js",
    "test/checkout.workflow.test.js",
    "test/postgres.concurrency.test.js",
    "test/postgres.checkout.concurrency.test.js",
    "test/show.catalog.test.js",
  ],
};

if (!suites[dialect]) {
  console.error("Usage: node scripts/run-tests.js postgres");
  process.exit(2);
}

const result = spawnSync(
  process.execPath,
  ["--test", "--test-concurrency=1", ...suites[dialect]],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      DB_DIALECT: "postgres",
    },
  },
);

process.exit(result.status === null ? 1 : result.status);
