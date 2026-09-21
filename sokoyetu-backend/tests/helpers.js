// Shared plumbing for the test suites: start the real Express app on an
// ephemeral port, talk to it over HTTP, and reset the database between tests.

const { TEST_DATABASE } = require('./env');
const db = require('../src/db');

let server = null;
let baseUrl = null;

// The env guard in ./env can only check what it was told. This one asks the
// database what it actually is, which is the check that matters before we start
// deleting rows.
async function assertConnectedToTestDatabase() {
  const { rows } = await db.query('SELECT current_database() AS name');
  const name = rows[0].name;

  if (name !== TEST_DATABASE || !/test/i.test(name)) {
    throw new Error(
      `Refusing to modify database "${name}" (expected "${TEST_DATABASE}"). ` +
        'These tests delete data.'
    );
  }

  return name;
}

async function startServer() {
  const ready = await db.waitForDatabase();

  if (!ready) {
    throw new Error(
      `Could not reach the test database "${TEST_DATABASE}". ` +
        'Start Postgres (npm run db:up) and run npm run test:setup.'
    );
  }

  await assertConnectedToTestDatabase();

  // Required here rather than at the top of the file so it is loaded after
  // ./env has set the environment it reads at import time.
  const app = require('../src/server');

  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });

  baseUrl = `http://127.0.0.1:${server.address().port}`;
  return baseUrl;
}

async function stopServer() {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
    server = null;
  }
  // Release the pool so the test process can exit instead of hanging.
  await db.raw().end().catch(() => {});
}

async function truncateAll() {
  await assertConnectedToTestDatabase();
  await db.query(
    'TRUNCATE users, suppliers, products, orders, payments RESTART IDENTITY CASCADE'
  );
}

async function request(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(baseUrl + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  let data = null;
  try {
    data = await response.json();
  } catch (err) {
    data = null;
  }

  return { status: response.status, data };
}

// Phone numbers must be unique per test even though the database is truncated
// between them: the login limiter counts failures in memory, keyed on IP plus
// phone, and truncating rows does not clear that counter.
let phoneCounter = 0;
function uniquePhone() {
  phoneCounter += 1;
  return `0799${String(phoneCounter).padStart(6, '0')}`;
}

async function registerUser({ role = 'retailer', password = 'password123', name, phone } = {}) {
  const usedPhone = phone || uniquePhone();
  const response = await request('POST', '/api/auth/register', {
    name: name || `Test ${role}`,
    phone: usedPhone,
    password,
    role,
    location: 'Kigali',
  });

  if (response.status !== 201) {
    throw new Error(`registerUser failed: ${response.status} ${JSON.stringify(response.data)}`);
  }

  return {
    phone: usedPhone,
    password,
    token: response.data.token,
    user: response.data.user,
  };
}

module.exports = {
  startServer,
  stopServer,
  truncateAll,
  request,
  uniquePhone,
  registerUser,
  getBaseUrl: () => baseUrl,
};
