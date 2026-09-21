// Rate limiting, with the limits deliberately turned down so the thresholds can
// be observed without firing hundreds of requests.
//
// These must be set BEFORE ../src/server is required, which happens inside
// startServer(). The register limiter gets its own file because it keys on the
// client IP: tripping it here would block registration for every later test.

require('./env');

process.env.LOGIN_RATE_LIMIT = '3';
process.env.PASSWORD_RATE_LIMIT = '3';
process.env.LOGOUT_ALL_RATE_LIMIT = '2';

const { test, before, after, beforeEach, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  startServer,
  stopServer,
  truncateAll,
  request,
  uniquePhone,
  registerUser,
} = require('./helpers');

before(startServer);
after(stopServer);
beforeEach(truncateAll);

describe('sign-in limiting', () => {
  test('blocks repeated failures for one account', async () => {
    const user = await registerUser();
    const statuses = [];

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const res = await request('POST', '/api/auth/login', {
        phone: user.phone,
        password: 'wrong-password',
      });
      statuses.push(res.status);
    }

    assert.deepEqual(statuses, [401, 401, 401, 429]);
  });

  test('a successful sign-in does not consume the allowance', async () => {
    const user = await registerUser();

    await request('POST', '/api/auth/login', { phone: user.phone, password: 'wrong-password' });
    await request('POST', '/api/auth/login', { phone: user.phone, password: 'wrong-password' });

    const success = await request('POST', '/api/auth/login', {
      phone: user.phone,
      password: user.password,
    });
    assert.equal(success.status, 200, 'a correct password must not be throttled');

    // Two failures used, so exactly one more is allowed before the block.
    const lastAllowed = await request('POST', '/api/auth/login', { phone: user.phone, password: 'wrong-password' });
    const blocked = await request('POST', '/api/auth/login', { phone: user.phone, password: 'wrong-password' });

    assert.equal(lastAllowed.status, 401);
    assert.equal(blocked.status, 429);
  });

  test('one account being attacked does not lock out another', async () => {
    // The key is IP *plus* phone, so a noisy account must not take the whole
    // network down with it.
    const victim = await registerUser();
    const bystander = await registerUser();

    for (let attempt = 0; attempt < 4; attempt += 1) {
      await request('POST', '/api/auth/login', { phone: victim.phone, password: 'wrong-password' });
    }

    const bystanderLogin = await request('POST', '/api/auth/login', {
      phone: bystander.phone,
      password: bystander.password,
    });

    assert.equal(bystanderLogin.status, 200);
  });

  test('the 429 carries the same error shape as the rest of the API', async () => {
    const user = await registerUser();

    for (let attempt = 0; attempt < 4; attempt += 1) {
      await request('POST', '/api/auth/login', { phone: user.phone, password: 'wrong-password' });
    }

    const res = await request('POST', '/api/auth/login', { phone: user.phone, password: 'wrong-password' });

    assert.equal(res.status, 429);
    assert.equal(typeof res.data.error, 'string');
  });

  test('an unknown phone is throttled too', async () => {
    const phone = uniquePhone();
    const statuses = [];

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const res = await request('POST', '/api/auth/login', { phone, password: 'wrong-password' });
      statuses.push(res.status);
    }

    assert.equal(statuses[3], 429);
  });
});

describe('password change limiting', () => {
  test('blocks repeated wrong current passwords for one user', async () => {
    const user = await registerUser();
    const statuses = [];

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const res = await request('PUT', '/api/auth/password', {
        currentPassword: 'wrong-password',
        newPassword: 'brand-new-password',
      }, user.token);
      statuses.push(res.status);
    }

    assert.deepEqual(statuses, [401, 401, 401, 429]);
  });

  test('a successful change does not consume the allowance', async () => {
    const user = await registerUser();

    // One failure, which leaves two of the three slots.
    await request('PUT', '/api/auth/password', {
      currentPassword: 'wrong-password',
      newPassword: 'brand-new-password',
    }, user.token);

    // A success, which must not take one of them.
    const success = await request('PUT', '/api/auth/password', {
      currentPassword: user.password,
      newPassword: 'brand-new-password',
    }, user.token);
    assert.equal(success.status, 200);

    // Both remaining slots are still available...
    const second = await request('PUT', '/api/auth/password', {
      currentPassword: 'wrong-password',
      newPassword: 'another-password',
    }, success.data.token);
    const third = await request('PUT', '/api/auth/password', {
      currentPassword: 'wrong-password',
      newPassword: 'another-password',
    }, success.data.token);

    assert.equal(second.status, 401);
    assert.equal(third.status, 401, 'the successful change must not have used a slot');

    // ...and the next failure is the one that trips it.
    const blocked = await request('PUT', '/api/auth/password', {
      currentPassword: 'wrong-password',
      newPassword: 'another-password',
    }, success.data.token);

    assert.equal(blocked.status, 429);
  });

  test('one user being attacked does not throttle another', async () => {
    const victim = await registerUser();
    const bystander = await registerUser();

    for (let attempt = 0; attempt < 4; attempt += 1) {
      await request('PUT', '/api/auth/password', {
        currentPassword: 'wrong-password',
        newPassword: 'brand-new-password',
      }, victim.token);
    }

    const bystanderChange = await request('PUT', '/api/auth/password', {
      currentPassword: bystander.password,
      newPassword: 'brand-new-password',
    }, bystander.token);

    assert.equal(bystanderChange.status, 200);
  });
});

describe('sign out everywhere limiting', () => {
  test('caps repeated calls for one user', async () => {
    const user = await registerUser();
    const statuses = [];

    for (let attempt = 0; attempt < 3; attempt += 1) {
      // Each call revokes the previous token, so sign in again to get a fresh one.
      const login = await request('POST', '/api/auth/login', {
        phone: user.phone,
        password: user.password,
      });
      const res = await request('POST', '/api/auth/logout-all', undefined, login.data.token);
      statuses.push(res.status);
    }

    assert.deepEqual(statuses, [200, 200, 429]);
  });
});
