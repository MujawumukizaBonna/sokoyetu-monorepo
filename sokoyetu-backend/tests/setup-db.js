// Creates (or rebuilds) the test database and applies the real schema to it.
//
// Run via `npm run test:setup`, or automatically as part of `npm test`. Starting
// from a dropped schema every time means a stale table cannot mask a broken
// migration.

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const { TEST_DATABASE, TEST_HOST } = require('./env');

const connection = {
  host: TEST_HOST,
  port: Number(process.env.PGPORT),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
};

async function ensureDatabaseExists() {
  // CREATE DATABASE cannot be parameterised, and cannot run inside a transaction.
  // The name is asserted to contain "test" in ./env and is not user input.
  const admin = new Client({ ...connection, database: 'postgres' });
  await admin.connect();
  try {
    const { rows } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [TEST_DATABASE]);
    if (rows.length > 0) return false;
    await admin.query(`CREATE DATABASE "${TEST_DATABASE}"`);
    return true;
  } finally {
    await admin.end();
  }
}

async function applySchema() {
  const client = new Client({ ...connection, database: TEST_DATABASE });
  await client.connect();
  try {
    await client.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;');

    const initPath = path.join(__dirname, '..', 'docker', 'postgres', 'init.sql');
    await client.query(fs.readFileSync(initPath, 'utf8'));

    const migrationsDir = path.join(__dirname, '..', 'docker', 'postgres', 'migrations');
    const migrations = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    for (const file of migrations) {
      await client.query(fs.readFileSync(path.join(migrationsDir, file), 'utf8'));
    }

    return migrations;
  } finally {
    await client.end();
  }
}

async function main() {
  const created = await ensureDatabaseExists();
  const migrations = await applySchema();

  console.log(
    `${created ? 'created' : 'reused'} database "${TEST_DATABASE}" on ${TEST_HOST}; ` +
      `applied init.sql + ${migrations.length} migration(s)`
  );
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Test database setup failed:', err.message);
    process.exit(1);
  });
}

module.exports = { ensureDatabaseExists, applySchema };
