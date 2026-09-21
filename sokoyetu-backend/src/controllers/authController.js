const db = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

const handleDatabaseError = (res, err) => {
  if (err && err.code === 'DB_UNAVAILABLE') {
    return res.status(503).json({
      error: 'PostgreSQL is not running. Start the database and try again.',
    });
  }

  return null;
};

// Single source of truth for the password rule. The frontend enforces the same
// minimum, but that is only a convenience - anything a client checks can be
// skipped, so the authoritative check has to live here.
const MIN_PASSWORD_LENGTH = 6;

// POST /api/auth/register
const register = async (req, res) => {
  const { name, phone, password, role, location } = req.body;

  if (!name || !phone || !password || !role) {
    return res.status(400).json({ error: 'Name, phone, password and role are required' });
  }

  if (!['retailer', 'manufacturer'].includes(role)) {
    return res.status(400).json({ error: 'Role must be retailer or manufacturer' });
  }

  // Enforced here as well as in the form, so the rule cannot be bypassed by
  // posting straight to the API.
  if (String(password).length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
  }

  try {
    const existing = await db.query('SELECT id FROM users WHERE phone = $1', [phone]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Phone number already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const result = await db.query(
      'INSERT INTO users (name, phone, password, role, location) VALUES ($1,$2,$3,$4,$5) RETURNING id, name, phone, role, location',
      [name, phone, hashedPassword, role, location || '']
    );

    const user = result.rows[0];

    // If manufacturer, auto-create a supplier profile
    if (role === 'manufacturer') {
      await db.query(
        'INSERT INTO suppliers (user_id, name, location) VALUES ($1,$2,$3)',
        [user.id, name, location || 'Kigali']
      );
    }

    const token = generateToken(user);
    res.status(201).json({ message: 'Account created successfully', token, user });

  } catch (err) {
    if (handleDatabaseError(res, err)) {
      return;
    }
    console.error('Register error:', err.message);
    res.status(500).json({ error: 'Server error during registration' });
  }
};

// POST /api/auth/login
const login = async (req, res) => {
  const { phone, password } = req.body;

  if (!phone || !password) {
    return res.status(400).json({ error: 'Phone and password are required' });
  }

  try {
    const result = await db.query('SELECT * FROM users WHERE phone = $1', [phone]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid phone number or password' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid phone number or password' });
    }

    const token = generateToken(user);
    const { password: _, ...userWithoutPassword } = user;

    res.json({ message: 'Login successful', token, user: userWithoutPassword });

  } catch (err) {
    if (handleDatabaseError(res, err)) {
      return;
    }
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Server error during login' });
  }
};

// GET /api/auth/me
const getMe = async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, name, phone, role, location, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    if (handleDatabaseError(res, err)) {
      return;
    }
    res.status(500).json({ error: 'Server error' });
  }
};

// PUT /api/auth/me
// Lets any signed-in user update their own display name and location.
//
// Deliberately NOT accepted:
//   phone    - it is the login identifier, so changing it needs a verified flow
//   role     - accepting it here would let anyone escalate to manufacturer
//   password - must go through a dedicated, validated change-password route
const updateMe = async (req, res) => {
  const { name, location } = req.body;

  if (name !== undefined && !String(name).trim()) {
    return res.status(400).json({ error: 'Name cannot be empty' });
  }

  try {
    const result = await db.query(
      `UPDATE users SET
        name = COALESCE($1, name),
        location = COALESCE($2, location)
       WHERE id = $3
       RETURNING id, name, phone, role, location, created_at`,
      [name === undefined ? null : String(name).trim(), location, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    if (handleDatabaseError(res, err)) {
      return;
    }
    console.error('Update me error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

// PUT /api/auth/password
// Lets a signed-in user change their own password.
//
// The current password must be supplied and verified even though the caller
// already holds a valid token. Without that check, anyone who got hold of a
// token - a shared device, a leaked log, an XSS bug - could set a new password
// and permanently lock the real owner out. Requiring the current password
// means a stolen token alone is not enough.
//
// Deliberately NOT accepted:
//   userId   - the account is taken from the token, never from the body, so
//              this endpoint cannot be used to change someone else's password
//   phone    - changing the login identifier is a separate, verified flow
const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required' });
  }

  if (String(newPassword).length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters` });
  }

  if (String(newPassword) === String(currentPassword)) {
    return res.status(400).json({ error: 'New password must be different from your current password' });
  }

  try {
    const result = await db.query('SELECT password FROM users WHERE id = $1', [req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const validCurrent = await bcrypt.compare(currentPassword, result.rows[0].password);

    if (!validCurrent) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await db.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, req.user.id]);

    // NOTE: tokens are stateless JWTs with a 7 day expiry, so sessions that are
    // already signed in stay valid after this change. Revoking them needs a
    // token version column; tracked in the README "Known gaps".
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    if (handleDatabaseError(res, err)) {
      return;
    }
    console.error('Change password error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = { register, login, getMe, updateMe, changePassword };
