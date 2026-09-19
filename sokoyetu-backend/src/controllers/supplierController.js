const db = require('../db');

// GET /api/suppliers
const getSuppliers = async (req, res) => {
  const { category, search } = req.query;
  try {
    let query = 'SELECT * FROM suppliers WHERE 1=1';
    const params = [];

    if (category && category !== 'All') {
      params.push(category);
      query += ` AND category = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      query += ` AND name ILIKE $${params.length}`;
    }

    query += ' ORDER BY verified DESC, rating DESC';
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Get suppliers error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

// GET /api/suppliers/:id
const getSupplierById = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM suppliers WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Supplier not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// GET /api/suppliers/my — manufacturer gets their own supplier profile
const getMySupplier = async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM suppliers WHERE user_id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Supplier profile not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// PUT /api/suppliers/my — manufacturer updates their profile
const updateMySupplier = async (req, res) => {
  const { name, category, description, location, emoji } = req.body;
  try {
    const result = await db.query(
      `UPDATE suppliers SET
        name = COALESCE($1, name),
        category = COALESCE($2, category),
        description = COALESCE($3, description),
        location = COALESCE($4, location),
        emoji = COALESCE($5, emoji)
      WHERE user_id = $6 RETURNING *`,
      [name, category, description, location, emoji, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = { getSuppliers, getSupplierById, getMySupplier, updateMySupplier };
