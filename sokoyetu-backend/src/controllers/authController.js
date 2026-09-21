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

// POST /api/auth/register
const register = async (req, res) => {
  const { name, phone, password, role, location } = req.body;

  if (!name || !phone || !password || !role) {
    return res.status(400).json({ error: 'Name, phone, password and role are required' });
  }

  if (!['retailer', 'manufacturer'].includes(role)) {
    return res.status(400).json({ error: 'Role must be retailer or manufacturer' });
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

module.exports = { register, login, getMe, updateMe };
