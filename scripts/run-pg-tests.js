/**
 * Runs the Postgres-level specs, the ones that need a real database.
 *
 * They are opt-in: every *-pg.spec.ts skips itself unless PG_INTEGRATION=1,
 * so `npm test` never reaches for a database. This sets that flag without a
 * cross-env dependency, and runs in band — these specs hold a transaction
 * open, and the pooler is in session mode with a small pool.
 *
 *   npm run test:pg                     every Postgres spec
 *   npm run test:pg -- -t "all-types"   one test by name
 */
const { spawnSync } = require('child_process');

const jest = require.resolve('jest/bin/jest');
// The `=` form matters: the pattern opens with "-", which yargs would
// otherwise read as another flag.
const args = ['--runInBand', '--testPathPatterns=-pg\\.spec\\.ts$', ...process.argv.slice(2)];

const result = spawnSync(process.execPath, [jest, ...args], {
  stdio: 'inherit',
  env: { ...process.env, PG_INTEGRATION: '1' },
});

process.exit(result.status === null ? 1 : result.status);
