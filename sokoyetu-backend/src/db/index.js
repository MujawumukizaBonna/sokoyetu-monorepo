const { Pool } = require('pg');
require('dotenv').config();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const buildPoolConfig = (overrides = {}) => ({
  max: 3,
  min: 0,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 10000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  ...overrides,
});

const isHostedConnection = (value) =>
  /supabase|neon|render|railway/i.test(value || '');

const primaryConfig = process.env.DATABASE_URL
  ? buildPoolConfig({
      connectionString: process.env.DATABASE_URL,
      ssl:
        process.env.DATABASE_SSL === 'false'
          ? false
          : isHostedConnection(process.env.DATABASE_URL) || process.env.DATABASE_SSL === 'true'
            ? { rejectUnauthorized: false }
            : false,
    })
  : buildPoolConfig({
      host: process.env.PGHOST || 'localhost',
      port: Number(process.env.PGPORT || 5432),
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || 'postgres',
      database: process.env.PGDATABASE || 'sokoyetu',
      ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
    });

const fallbackConfig = buildPoolConfig({
  host: 'localhost',
  port: 5432,
  user: process.env.PGUSER_LOCAL || 'sokoyetu',
  password: process.env.PGPASSWORD_LOCAL || 'sokoyetu',
  database: process.env.PGDATABASE_LOCAL || 'sokoyetu',
  ssl: false,
});

const createPool = (config) => new Pool(config);

let activePool = createPool(primaryConfig);
let activeLabel = process.env.DATABASE_URL ? 'primary' : 'local';

const status = {
  ready: false,
  attempts: 0,
  lastError: null,
  mode: activeLabel,
};

activePool.on('error', (err) => {
  status.lastError = err;
  status.ready = false;
  console.error('Unexpected PostgreSQL pool error:', err.message || err.code || 'unknown error');
});

const connectPool = async (pool, label, retries = 5) => {
  for (let i = 0; i < retries; i += 1) {
    status.attempts = i + 1;
    try {
      const client = await pool.connect();
      client.release();
      status.ready = true;
      status.lastError = null;
      status.mode = label;
      console.log(`Connected to PostgreSQL (${label}) successfully`);
      return true;
    } catch (err) {
      status.ready = false;
      status.lastError = err;
      console.error(`Database connection attempt ${i + 1} for ${label} failed: ${err.message || err.code || 'unknown error'}`);
      if (i < retries - 1) {
        await sleep(3000);
      }
    }
  }

  return false;
};

const initializeDatabase = async () => {
  const primaryReady = await connectPool(activePool, activeLabel);
  if (primaryReady) {
    return true;
  }

  const shouldTryFallback = process.env.DATABASE_FALLBACK !== 'false' && activeLabel === 'primary';
  if (!shouldTryFallback) {
    console.error('PostgreSQL is unavailable after multiple attempts.');
    return false;
  }

  const fallbackPool = createPool(fallbackConfig);
  fallbackPool.on('error', (err) => {
    status.lastError = err;
    status.ready = false;
    console.error('Unexpected PostgreSQL fallback pool error:', err.message || err.code || 'unknown error');
  });

  const fallbackReady = await connectPool(fallbackPool, 'local');
  if (fallbackReady) {
    await activePool.end().catch(() => {});
    activePool = fallbackPool;
    activeLabel = 'local';
    return true;
  }

  console.error('PostgreSQL is unavailable after multiple attempts.');
  return false;
};

const readyPromise = initializeDatabase();

const query = async (...args) => {
  const ready = await readyPromise;
  if (!ready) {
    const error = new Error('PostgreSQL is not running');
    error.code = 'DB_UNAVAILABLE';
    throw error;
  }

  return activePool.query(...args);
};

const waitForDatabase = () => readyPromise;

const getDatabaseStatus = () => ({
  ready: status.ready,
  attempts: status.attempts,
  lastError: status.lastError
    ? status.lastError.message || status.lastError.code || 'unknown error'
    : null,
  mode: status.mode,
});

module.exports = {
  query,
  waitForDatabase,
  getDatabaseStatus,
  raw: () => activePool,
};
