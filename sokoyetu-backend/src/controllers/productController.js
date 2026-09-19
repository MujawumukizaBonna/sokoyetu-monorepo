const db = require('../db');

const isPositiveInteger = (value) => Number.isSafeInteger(Number(value)) && Number(value) > 0;
const isNonNegativeInteger = (value) => Number.isSafeInteger(Number(value)) && Number(value) >= 0;

const getProducts = async (req, res) => {
  const { supplier_id } = req.query;
  try {
    let query = 'SELECT * FROM products WHERE available = true';
    const params = [];
    if (supplier_id) {
      params.push(supplier_id);
      query += ` AND supplier_id = $${params.length}`;
    }
    query += ' ORDER BY created_at DESC';
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

const getProductById = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM products WHERE id = $1 AND available = true', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

const createProduct = async (req, res) => {
  const { name, emoji, price_rwf, unit, moq, stock, category, description, available } = req.body;
  if (!name?.trim() || !isPositiveInteger(price_rwf) || !isPositiveInteger(moq) || !isNonNegativeInteger(stock)) {
    return res.status(400).json({ error: 'Provide a product name, positive price and MOQ, and non-negative stock' });
  }

  try {
    const supplierResult = await db.query('SELECT id FROM suppliers WHERE user_id = $1', [req.user.id]);
    if (supplierResult.rows.length === 0) return res.status(403).json({ error: 'No supplier profile found' });

    const result = await db.query(
      `INSERT INTO products (supplier_id, name, emoji, price_rwf, unit, moq, stock, category, description, available)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [supplierResult.rows[0].id, name.trim(), emoji || '📦', Number(price_rwf), unit || 'unit', Number(moq), Number(stock), category || 'General', description || null, available !== false]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create product error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

const updateProduct = async (req, res) => {
  const { name, price_rwf, unit, moq, stock, available, emoji, category, description } = req.body;
  if ((price_rwf !== undefined && !isPositiveInteger(price_rwf)) || (moq !== undefined && !isPositiveInteger(moq)) || (stock !== undefined && !isNonNegativeInteger(stock))) {
    return res.status(400).json({ error: 'Price and MOQ must be positive, and stock cannot be negative' });
  }

  try {
    const result = await db.query(
      `UPDATE products p SET
        name = COALESCE($1, p.name), price_rwf = COALESCE($2, p.price_rwf), unit = COALESCE($3, p.unit),
        moq = COALESCE($4, p.moq), stock = COALESCE($5, p.stock), available = COALESCE($6, p.available),
        emoji = COALESCE($7, p.emoji), category = COALESCE($8, p.category), description = COALESCE($9, p.description)
       FROM suppliers s
       WHERE p.id = $10 AND p.supplier_id = s.id AND s.user_id = $11 RETURNING p.*`,
      [name?.trim(), price_rwf === undefined ? null : Number(price_rwf), unit, moq === undefined ? null : Number(moq), stock === undefined ? null : Number(stock), available, emoji, category, description, req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const result = await db.query(
      `UPDATE products p SET available = false
       FROM suppliers s
       WHERE p.id = $1 AND p.supplier_id = s.id AND s.user_id = $2 RETURNING p.id`,
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    res.json({ message: 'Product deactivated' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = { getProducts, getProductById, createProduct, updateProduct, deleteProduct };
