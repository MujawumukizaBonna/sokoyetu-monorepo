// Applies the SQL migrations in docker/postgres/migrations to whatever database
// the environment points at, then checks that the schema the running code
// depends on is actually present.
//
// Why this exists: before it, migrations were only ever applied by
// docker/postgres/init.sql on a brand-new database, or by tests/setup-db.js in
// CI. Nothing applied them to a hosted database, so shipping a release that read
// a new column (users.token_version) against a database that had not been
// altered by hand meant every authenticated request failed with a 500. The
// schema change and the code that needs it now travel together.
//
// Run automatically on boot (see src/server.js) or by hand with
// `npm run db:migrate`.

const fs = require('fs');
const path = require('path');

const db = require('./index');

const POSTGRES_DIR = path.join(__dirname, '..', '..', 'docker', 'postgres');
const MIGRATIONS_DIR = path.join(POSTGRES_DIR, 'migrations');
const INIT_SQL_PATH = path.join(POSTGRES_DIR, 'init.sql');

// Columns the code reads. A missing one turns into a 500 on every request that
// touches it, so the runner refuses to report success without them.
const REQUIRED_COLUMNS = [
  ['public', 'users', 'token_version'],
  ['public', 'products', 'description'],
  ['public', 'payments', 'provider_code'],
];

function readMigrations() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((file) => ({
      name: file,
      sql: fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'),
    }));
}

async function baselineExists(client) {
  const { rows } = await client.query("SELECT to_regclass('public.users') AS reg");
  return rows[0].reg !== null;
}

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.schema_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

// `required` is injectable so a test can ask about a column it knows is absent
// without having to damage a real schema first.
async function findMissingColumns(client, required = REQUIRED_COLUMNS) {
  const missing = [];

  for (const [schema, table, column] of required) {
    const { rows } = await client.query(
      `SELECT 1
         FROM information_schema.columns
        WHERE table_schema = $1
          AND table_name = $2
          AND column_name = $3`,
      [schema, table, column]
    );

    if (rows.length === 0) {
      missing.push(`${schema}.${table}.${column}`);
    }
  }

  return missing;
}

// Claims the migration and applies it in one transaction.
//
// The INSERT is the mutual exclusion, not an advisory lock: two instances
// starting at the same moment both try to insert the same primary key, the
// second blocks until the first commits and then sees the conflict and skips.
// An advisory lock would be the more obvious choice, but it does not survive a
// transaction-mode connection pooler, which is what hosted Postgres is often
// reached through.
//
// Because the claim and the DDL share a transaction, a migration that fails is
// rolled back and left unrecorded, so the next boot retries it.
async function applyMigration(client, migration) {
  await client.query('BEGIN');

  try {
    const claimed = await client.query(
      `INSERT INTO public.schema_migrations (name)
       VALUES ($1)
       ON CONFLICT (name) DO NOTHING
       RETURNING name`,
      [migration.name]
    );

    if (claimed.rows.length === 0) {
      await client.query('ROLLBACK');
      return false;
    }

    await client.query(migration.sql);
    await client.query('COMMIT');
    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

/**
 * Brings the database up to date, then verifies the schema.
 *
 * @param {object}  [options]
 * @param {boolean} [options.apply=true]  When false, nothing is written: the
 *   schema is only checked. Used for MIGRATIONS_ON_STARTUP=false, where the
 *   database user is not allowed to run DDL but we still want to know the
 *   schema is right before serving traffic.
 * @param {object}  [options.logger]      Defaults to console.
 * @returns {Promise<{applied: string[], total: number, verified: boolean}>}
 */
async function migrate({ apply = true, logger = console } = {}) {
  const ready = await db.waitForDatabase();

  if (!ready) {
    throw new Error(
      'The database is not reachable, so migrations could not run. ' +
        'Check DATABASE_URL / the PG* environment variables and that Postgres is up.'
    );
  }

  const client = await db.raw().connect();
  const applied = [];

  try {
    if (apply) {
      if (!(await baselineExists(client))) {
        logger.log('Empty database - applying docker/postgres/init.sql as the baseline.');
        await client.query(fs.readFileSync(INIT_SQL_PATH, 'utf8'));
      }

      await ensureMigrationsTable(client);

      const migrations = readMigrations();

      for (const migration of migrations) {
        if (await applyMigration(client, migration)) {
          logger.log(`Applied migration ${migration.name}`);
          applied.push(migration.name);
        }
      }

      const missing = await findMissingColumns(client);
      if (missing.length > 0) {
        throw new Error(
          `The database is missing required column(s): ${missing.join(', ')}. ` +
            'Every migration reported success, so a migration is incomplete or a later ' +
            'one undid an earlier change.'
        );
      }

      return { applied, total: migrations.length, verified: true };
    }

    // Verification only. Reading information_schema needs no DDL privileges.
    const missing = await findMissingColumns(client);

    if (missing.length > 0) {
      throw new Error(
        `The database is missing required column(s): ${missing.join(', ')}. ` +
          'Migrations are switched off (MIGRATIONS_ON_STARTUP=false), so apply them ' +
          'with `npm run db:migrate` before starting this build.'
      );
    }

    return { applied, total: readMigrations().length, verified: true };
  } finally {
    client.release();
  }
}

if (require.main === module) {
  // `--verify` checks the schema without writing anything, which is what
  // `npm run db:verify` uses. MIGRATIONS_ON_STARTUP=false means the same thing,
  // so a container can run this file as its command either way.
  const verifyOnly =
    process.argv.includes('--verify') || process.env.MIGRATIONS_ON_STARTUP === 'false';

  migrate({ apply: !verifyOnly })
    .then(({ applied, total }) => {
      if (verifyOnly) {
        console.log('Schema verified; nothing was changed.');
      } else if (applied.length === 0) {
        console.log(`Already up to date (${total} migration(s) on record).`);
      } else {
        console.log(`Applied ${applied.length} of ${total} migration(s): ${applied.join(', ')}`);
      }

      return db.raw().end();
    })
    .catch((err) => {
      console.error('Migration failed:', err.message);
      process.exit(1);
    });
}

module.exports = { migrate, findMissingColumns, readMigrations, REQUIRED_COLUMNS, MIGRATIONS_DIR };
