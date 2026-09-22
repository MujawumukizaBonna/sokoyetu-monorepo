// Exercises src/db/migrate.js against the test database.
//
// The runner is the only thing standing between a release and a database that
// has not been altered to match it, so it is worth testing directly rather than
// trusting that it runs. Before it existed, shipping code that read
// users.token_version against an unaltered database made every authenticated
// request fail.

const fs = require('fs');
const { describe, test, before } = require('node:test');
const assert = require('node:assert/strict');

require('./env');

const db = require('../src/db');
const {
  migrate,
  findMissingColumns,
  readMigrations,
  REQUIRED_COLUMNS,
  MIGRATIONS_DIR,
} = require('../src/db/migrate');
const { assertConnectedToTestDatabase } = require('./helpers');

// Swallow the runner's progress logging so the test output stays readable.
const silent = { log() {} };

const withClient = async (fn) => {
  const client = await db.raw().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
};

before(async () => {
  const ready = await db.waitForDatabase();
  assert.ok(ready, 'the test database must be reachable - run npm test, which sets it up');

  // Same guard the other suites use, because this file writes to the database.
  await assertConnectedToTestDatabase();
});

describe('migration files', () => {
  test('reads every .sql file in the migrations directory', () => {
    const onDisk = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    assert.ok(onDisk.length > 0, 'there should be at least one migration');
    assert.deepEqual(readMigrations().map((m) => m.name), onDisk);
  });

  test('names them so filename order is numeric order', () => {
    // Zero-padded three-digit prefixes are what let a plain string sort be
    // correct. A file called "10_x.sql" would sort before "2_x.sql".
    for (const migration of readMigrations()) {
      assert.match(migration.name, /^\d{3}_/, `${migration.name} should start with a 3-digit number`);
    }
  });

  test('carries the SQL for each file', () => {
    for (const migration of readMigrations()) {
      assert.ok(migration.sql.trim().length > 0, `${migration.name} should not be empty`);
    }
  });
});

describe('schema verification', () => {
  test('reports nothing missing once the migrations have been applied', async () => {
    const missing = await withClient((client) => findMissingColumns(client));
    assert.deepEqual(missing, []);
  });

  test('reports a column that is not there', async () => {
    // Injected rather than damaging a real schema to create the condition.
    const missing = await withClient((client) =>
      findMissingColumns(client, [['public', 'users', 'no_such_column_zzz']])
    );

    assert.deepEqual(missing, ['public.users.no_such_column_zzz']);
  });

  test('reports every missing column, not just the first', async () => {
    const missing = await withClient((client) =>
      findMissingColumns(client, [
        ['public', 'users', 'no_such_column_aaa'],
        ['public', 'products', 'no_such_column_bbb'],
      ])
    );

    assert.deepEqual(missing, ['public.users.no_such_column_aaa', 'public.products.no_such_column_bbb']);
  });

  test('lists the columns the running code depends on', () => {
    // The check is only useful if it covers the columns that actually broke
    // things. token_version is the one that took down every authenticated route.
    const flat = REQUIRED_COLUMNS.map(([schema, table, column]) => `${schema}.${table}.${column}`);
    assert.ok(flat.includes('public.users.token_version'));
  });
});

describe('applying migrations', () => {
  test('records every migration and has nothing left to do on a second run', async () => {
    await migrate({ apply: true, logger: silent });

    const second = await migrate({ apply: true, logger: silent });
    assert.deepEqual(second.applied, [], 'a second run must not reapply anything');

    const { rows } = await db.query('SELECT name FROM public.schema_migrations ORDER BY name');
    assert.deepEqual(
      rows.map((row) => row.name),
      readMigrations().map((m) => m.name),
      'every migration file should be recorded exactly once'
    );
  });

  test('survives a third run', async () => {
    // Two runs prove idempotency; a third proves the recorded state is stable
    // rather than something the second run happened to repair.
    const result = await migrate({ apply: true, logger: silent });
    assert.deepEqual(result.applied, []);
  });

  test('verify-only mode changes nothing', async () => {
    const before = await db.query('SELECT count(*)::int AS n FROM public.schema_migrations');

    const result = await migrate({ apply: false, logger: silent });

    assert.equal(result.verified, true);
    assert.deepEqual(result.applied, []);

    const after = await db.query('SELECT count(*)::int AS n FROM public.schema_migrations');
    assert.equal(after.rows[0].n, before.rows[0].n);
  });
});
