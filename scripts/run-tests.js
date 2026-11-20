const { spawnSync } = require('node:child_process');

const dialect = (process.argv[2] || 'sqlite').toLowerCase();
if (!['sqlite', 'postgres', 'postgresql', 'mysql'].includes(dialect)) {
  console.error('Usage: node scripts/run-tests.js [sqlite|postgres|mysql]');
  process.exit(2);
}
const result = spawnSync(process.execPath, ['--test'], {
  stdio: 'inherit',
  env: { ...process.env, DB_DIALECT: dialect }
});
process.exit(result.status === null ? 1 : result.status);
