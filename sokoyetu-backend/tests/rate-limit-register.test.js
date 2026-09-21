// The registration limiter gets its own file.
//
// It keys on the client IP, and every request in this suite comes from
// 127.0.0.1, so tripping it here would block registration for the rest of the
// process. Node's test runner gives each file its own process, which keeps this
// file's exhausted bucket from leaking into the others.

require('./env');

process.env.REGISTER_RATE_LIMIT = '2';

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { startServer, stopServer, truncateAll, request, uniquePhone } = require('./helpers');

before(startServer);
after(stopServer);
beforeEach(truncateAll);

test('caps account creation from one network', async () => {
  const statuses = [];

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const res = await request('POST', '/api/auth/register', {
      name: 'Rate Limited',
      phone: uniquePhone(),
      password: 'password123',
      role: 'retailer',
      location: 'Kigali',
    });
    statuses.push(res.status);
  }

  assert.deepEqual(statuses, [201, 201, 429]);
});

test('the 429 carries the same error shape as the rest of the API', async () => {
  const res = await request('POST', '/api/auth/register', {
    name: 'Rate Limited',
    phone: uniquePhone(),
    password: 'password123',
    role: 'retailer',
    location: 'Kigali',
  });

  assert.equal(res.status, 429);
  assert.equal(typeof res.data.error, 'string');
});
