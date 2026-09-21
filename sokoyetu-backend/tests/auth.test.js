// Authentication: registration, sign-in, profile, password change, session
// revocation and sign-out-everywhere.

require('./env');

const { test, before, after, beforeEach, describe } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

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

describe('registration', () => {
  test('creates a retailer and returns a usable token', async () => {
    const res = await request('POST', '/api/auth/register', {
      name: 'Amina Uwimana',
      phone: uniquePhone(),
      password: 'password123',
      role: 'retailer',
      location: 'Kigali',
    });

    assert.equal(res.status, 201);
    assert.ok(res.data.token, 'expected a token');
    assert.equal(res.data.user.name, 'Amina Uwimana');
    assert.equal(res.data.user.role, 'retailer');
  });

  test('never returns the password hash', async () => {
    const res = await request('POST', '/api/auth/register', {
      name: 'Hash Check',
      phone: uniquePhone(),
      password: 'password123',
      role: 'retailer',
      location: 'Kigali',
    });

    assert.equal(res.status, 201);
    assert.equal(res.data.user.password, undefined);
  });

  test('auto-creates a supplier profile for a manufacturer', async () => {
    const manufacturer = await registerUser({ role: 'manufacturer', name: 'Inyange Works' });

    const supplier = await request('GET', '/api/suppliers/my', undefined, manufacturer.token);

    assert.equal(supplier.status, 200);
    assert.equal(supplier.data.name, 'Inyange Works');
  });

  test('rejects missing fields', async () => {
    const res = await request('POST', '/api/auth/register', { phone: uniquePhone() });
    assert.equal(res.status, 400);
  });

  test('rejects an unknown role', async () => {
    const res = await request('POST', '/api/auth/register', {
      name: 'Bad Role',
      phone: uniquePhone(),
      password: 'password123',
      role: 'admin',
      location: 'Kigali',
    });

    assert.equal(res.status, 400);
  });

  test('enforces the password minimum server side, not just in the form', async () => {
    const res = await request('POST', '/api/auth/register', {
      name: 'Short Password',
      phone: uniquePhone(),
      password: 'abc',
      role: 'retailer',
      location: 'Kigali',
    });

    assert.equal(res.status, 400);
  });

  test('rejects a phone number that is already registered', async () => {
    const existing = await registerUser();

    const res = await request('POST', '/api/auth/register', {
      name: 'Duplicate',
      phone: existing.phone,
      password: 'password123',
      role: 'retailer',
      location: 'Kigali',
    });

    assert.equal(res.status, 409);
  });
});

describe('sign in', () => {
  test('returns a token for the right password', async () => {
    const user = await registerUser();

    const res = await request('POST', '/api/auth/login', {
      phone: user.phone,
      password: user.password,
    });

    assert.equal(res.status, 200);
    assert.ok(res.data.token);
    assert.equal(res.data.user.password, undefined);
  });

  test('rejects a wrong password', async () => {
    const user = await registerUser();

    const res = await request('POST', '/api/auth/login', {
      phone: user.phone,
      password: 'not-the-password',
    });

    assert.equal(res.status, 401);
  });

  test('rejects an unknown phone number', async () => {
    const res = await request('POST', '/api/auth/login', {
      phone: uniquePhone(),
      password: 'password123',
    });

    assert.equal(res.status, 401);
  });

  test('gives the same message for a wrong password and an unknown account', async () => {
    const user = await registerUser();

    const wrongPassword = await request('POST', '/api/auth/login', {
      phone: user.phone,
      password: 'not-the-password',
    });
    const unknownPhone = await request('POST', '/api/auth/login', {
      phone: uniquePhone(),
      password: 'password123',
    });

    assert.equal(wrongPassword.data.error, unknownPhone.data.error);
  });
});

describe('profile', () => {
  test('GET /auth/me requires a token', async () => {
    const res = await request('GET', '/api/auth/me');
    assert.equal(res.status, 401);
  });

  test('GET /auth/me returns the signed-in user', async () => {
    const user = await registerUser();

    const res = await request('GET', '/api/auth/me', undefined, user.token);

    assert.equal(res.status, 200);
    assert.equal(res.data.phone, user.phone);
    assert.equal(res.data.password, undefined);
  });

  test('PUT /auth/me updates name and location', async () => {
    const user = await registerUser();

    const res = await request('PUT', '/api/auth/me', {
      name: 'Renamed Person',
      location: 'Musanze',
    }, user.token);

    assert.equal(res.status, 200);
    assert.equal(res.data.name, 'Renamed Person');
    assert.equal(res.data.location, 'Musanze');
  });

  test('PUT /auth/me rejects an empty name', async () => {
    const user = await registerUser();

    const res = await request('PUT', '/api/auth/me', { name: '   ' }, user.token);

    assert.equal(res.status, 400);
  });

  test('PUT /auth/me cannot escalate the role', async () => {
    const user = await registerUser({ role: 'retailer' });

    const res = await request('PUT', '/api/auth/me', { role: 'manufacturer' }, user.token);

    assert.equal(res.status, 200);
    assert.equal(res.data.role, 'retailer', 'role must not be changeable here');

    // Confirm against the database, not just the response body.
    const me = await request('GET', '/api/auth/me', undefined, user.token);
    assert.equal(me.data.role, 'retailer');
  });

  test('PUT /auth/me cannot change the login phone number', async () => {
    const user = await registerUser();

    const res = await request('PUT', '/api/auth/me', { phone: uniquePhone() }, user.token);

    assert.equal(res.status, 200);
    assert.equal(res.data.phone, user.phone);
  });
});

describe('changing a password', () => {
  test('requires the current password', async () => {
    const user = await registerUser();

    const res = await request('PUT', '/api/auth/password', {
      newPassword: 'brand-new-password',
    }, user.token);

    assert.equal(res.status, 400);
  });

  test('rejects a wrong current password', async () => {
    const user = await registerUser();

    const res = await request('PUT', '/api/auth/password', {
      currentPassword: 'definitely-not-it',
      newPassword: 'brand-new-password',
    }, user.token);

    assert.equal(res.status, 401);
  });

  test('a failed change does not carry the session-invalid code', async () => {
    // The frontend only signs the user out when it sees this code, so a mistyped
    // password must not produce it.
    const user = await registerUser();

    const res = await request('PUT', '/api/auth/password', {
      currentPassword: 'definitely-not-it',
      newPassword: 'brand-new-password',
    }, user.token);

    assert.equal(res.status, 401);
    assert.equal(res.data.code, undefined);
  });

  test('a failed change leaves the old password working', async () => {
    const user = await registerUser();

    await request('PUT', '/api/auth/password', {
      currentPassword: 'definitely-not-it',
      newPassword: 'brand-new-password',
    }, user.token);

    const login = await request('POST', '/api/auth/login', {
      phone: user.phone,
      password: user.password,
    });

    assert.equal(login.status, 200);
  });

  test('rejects a new password that is too short', async () => {
    const user = await registerUser();

    const res = await request('PUT', '/api/auth/password', {
      currentPassword: user.password,
      newPassword: 'abc',
    }, user.token);

    assert.equal(res.status, 400);
  });

  test('rejects a new password identical to the current one', async () => {
    const user = await registerUser();

    const res = await request('PUT', '/api/auth/password', {
      currentPassword: user.password,
      newPassword: user.password,
    }, user.token);

    assert.equal(res.status, 400);
  });

  test('changes the password and returns a replacement token', async () => {
    const user = await registerUser();

    const res = await request('PUT', '/api/auth/password', {
      currentPassword: user.password,
      newPassword: 'brand-new-password',
    }, user.token);

    assert.equal(res.status, 200);
    assert.ok(res.data.token, 'expected a replacement token');

    const withReplacement = await request('GET', '/api/auth/me', undefined, res.data.token);
    assert.equal(withReplacement.status, 200);
  });

  test('the old password stops working and the new one starts', async () => {
    const user = await registerUser();

    await request('PUT', '/api/auth/password', {
      currentPassword: user.password,
      newPassword: 'brand-new-password',
    }, user.token);

    const oldPassword = await request('POST', '/api/auth/login', {
      phone: user.phone,
      password: user.password,
    });
    const newPassword = await request('POST', '/api/auth/login', {
      phone: user.phone,
      password: 'brand-new-password',
    });

    assert.equal(oldPassword.status, 401);
    assert.equal(newPassword.status, 200);
  });

  test('a userId in the body cannot redirect the change at another account', async () => {
    const victim = await registerUser();
    const attacker = await registerUser();

    const res = await request('PUT', '/api/auth/password', {
      userId: victim.user.id,
      currentPassword: attacker.password,
      newPassword: 'attacker-new-password',
    }, attacker.token);

    assert.equal(res.status, 200);

    // The attacker's own password changed...
    const attackerLogin = await request('POST', '/api/auth/login', {
      phone: attacker.phone,
      password: 'attacker-new-password',
    });
    assert.equal(attackerLogin.status, 200);

    // ...and the victim's did not.
    const victimLogin = await request('POST', '/api/auth/login', {
      phone: victim.phone,
      password: victim.password,
    });
    assert.equal(victimLogin.status, 200);
  });
});

describe('session revocation', () => {
  test('changing a password revokes other devices but not the caller', async () => {
    const user = await registerUser();

    const secondDevice = await request('POST', '/api/auth/login', {
      phone: user.phone,
      password: user.password,
    });
    const otherToken = secondDevice.data.token;

    assert.equal((await request('GET', '/api/auth/me', undefined, user.token)).status, 200);
    assert.equal((await request('GET', '/api/auth/me', undefined, otherToken)).status, 200);

    const changed = await request('PUT', '/api/auth/password', {
      currentPassword: user.password,
      newPassword: 'brand-new-password',
    }, user.token);

    // The caller keeps working via the replacement token...
    assert.equal(
      (await request('GET', '/api/auth/me', undefined, changed.data.token)).status,
      200
    );

    // ...while the token it used and the other device are both refused.
    const callerOldToken = await request('GET', '/api/auth/me', undefined, user.token);
    const otherDevice = await request('GET', '/api/auth/me', undefined, otherToken);

    assert.equal(callerOldToken.status, 401);
    assert.equal(otherDevice.status, 401);
  });

  test('a revoked token carries the session-invalid code', async () => {
    const user = await registerUser();

    await request('PUT', '/api/auth/password', {
      currentPassword: user.password,
      newPassword: 'brand-new-password',
    }, user.token);

    const res = await request('GET', '/api/auth/me', undefined, user.token);

    assert.equal(res.status, 401);
    assert.equal(res.data.code, 'SESSION_INVALID');
  });

  test('a token with no version field still works until that user changes their password', async () => {
    // Tokens minted before token_version existed carry no `tv`. Treating them as
    // version 0 is what stops a deploy from signing everybody out.
    const user = await registerUser();

    const legacyToken = jwt.sign(
      { id: user.user.id, role: 'retailer', name: user.user.name },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const before = await request('GET', '/api/auth/me', undefined, legacyToken);
    assert.equal(before.status, 200);

    await request('PUT', '/api/auth/password', {
      currentPassword: user.password,
      newPassword: 'brand-new-password',
    }, legacyToken);

    const after = await request('GET', '/api/auth/me', undefined, legacyToken);
    assert.equal(after.status, 401);
  });

  test('a bogus token is refused with the session-invalid code', async () => {
    const res = await request('GET', '/api/auth/me', undefined, 'not.a.real.token');

    assert.equal(res.status, 401);
    assert.equal(res.data.code, 'SESSION_INVALID');
  });
});

describe('sign out everywhere', () => {
  test('revokes every device including the caller, and returns no token', async () => {
    const user = await registerUser();

    const secondDevice = await request('POST', '/api/auth/login', {
      phone: user.phone,
      password: user.password,
    });
    const otherToken = secondDevice.data.token;

    const res = await request('POST', '/api/auth/logout-all', undefined, user.token);

    assert.equal(res.status, 200);
    assert.equal(res.data.token, undefined, 'must not hand back a usable token');

    const caller = await request('GET', '/api/auth/me', undefined, user.token);
    const other = await request('GET', '/api/auth/me', undefined, otherToken);

    assert.equal(caller.status, 401);
    assert.equal(caller.data.code, 'SESSION_INVALID');
    assert.equal(other.status, 401);
  });

  test('the account is still usable afterwards', async () => {
    const user = await registerUser();

    await request('POST', '/api/auth/logout-all', undefined, user.token);

    const login = await request('POST', '/api/auth/login', {
      phone: user.phone,
      password: user.password,
    });

    assert.equal(login.status, 200);
    assert.equal(
      (await request('GET', '/api/auth/me', undefined, login.data.token)).status,
      200
    );
  });

  test('requires a token', async () => {
    const res = await request('POST', '/api/auth/logout-all');
    assert.equal(res.status, 401);
  });
});
