// Test environment. This must be required BEFORE anything that reads process.env
// at import time - notably src/db/index.js, which builds its connection pool as
// soon as it is loaded.
//
// DATABASE_URL is deliberately set to an empty string. dotenv does not overwrite
// a key that already exists, and an empty value is falsy, so src/db/index.js
// falls through to the PGHOST branch and points at the local Docker Postgres
// rather than the hosted database named in .env.
//
// The tests below truncate tables, so pointing them at anything real would
// destroy data. See the guard at the bottom.

const TEST_DATABASE = process.env.TEST_PGDATABASE || 'sokoyetu_test';
const TEST_HOST = process.env.TEST_PGHOST || 'localhost';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = '';
process.env.PGHOST = TEST_HOST;
process.env.PGPORT = process.env.TEST_PGPORT || '5432';
process.env.PGUSER = process.env.TEST_PGUSER || 'sokoyetu';
process.env.PGPASSWORD = process.env.TEST_PGPASSWORD || 'sokoyetu';
process.env.PGDATABASE = TEST_DATABASE;
process.env.JWT_SECRET = process.env.TEST_JWT_SECRET || 'test-secret-not-for-production';
// Belt and braces: never let the pool fall back to the default dev database.
process.env.DATABASE_FALLBACK = 'false';

// The register and API limiters key on the client IP, and every request in this
// suite comes from 127.0.0.1, so they would throttle the suite itself. Raise them
// out of the way; the limiters get their own dedicated file (rate-limit.test.js)
// where they are deliberately turned down.
process.env.REGISTER_RATE_LIMIT = '1000';
process.env.API_RATE_LIMIT = '100000';
process.env.LOGIN_RATE_LIMIT = '1000';

// --- safety guard ----------------------------------------------------------
// Refuse to run rather than trust that the environment was set up correctly.
// The helpers repeat this check against the live connection, because this one
// can only inspect what it was told, not what was actually connected to.
if (/supabase|neon|render|railway|amazonaws|azure|\.com|\.io|\.net/i.test(TEST_HOST)) {
  throw new Error(
    `Refusing to run tests: TEST_PGHOST looks like a hosted database ("${TEST_HOST}"). ` +
      'This suite deletes data.'
  );
}

if (!/test/i.test(TEST_DATABASE)) {
  throw new Error(
    `Refusing to run tests: the database name must contain "test", got "${TEST_DATABASE}". ` +
      'This suite deletes data.'
  );
}

module.exports = { TEST_DATABASE, TEST_HOST };
