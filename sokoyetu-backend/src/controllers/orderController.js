const db = require('../db');

// POST /api/orders - retailer places order
const createOrder = async (req, res) => {
  const { product_id, quantity, delivery_location } = req.body;
  let stockReserved = false;
  let reservedProductId = null;

  const requestedQuantity = Number(quantity);
  if (!product_id || !Number.isSafeInteger(requestedQuantity) || requestedQuantity <= 0) {
    return res.status(400).json({ error: 'Product and quantity are required' });
  }

  try {
    const productResult = await db.query('SELECT * FROM products WHERE id = $1 AND available = true', [product_id]);
    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const product = productResult.rows[0];
    if (requestedQuantity < product.moq) {
      return res.status(400).json({ error: `Minimum order quantity is ${product.moq} units` });
    }
    if (requestedQuantity > product.stock) {
      return res.status(400).json({ error: `Only ${product.stock} units are currently available` });
    }

    const stockUpdate = await db.query(
      'UPDATE products SET stock = stock - $1 WHERE id = $2 AND available = true AND stock >= $1 RETURNING stock',
      [requestedQuantity, product_id]
    );
    if (stockUpdate.rows.length === 0) {
      return res.status(409).json({ error: 'This product no longer has enough stock. Please refresh and try again.' });
    }
    stockReserved = true;
    reservedProductId = product_id;

    const delivery_fee = 1500;
    const total_rwf = (product.price_rwf * requestedQuantity) + delivery_fee;

    const result = await db.query(
      `INSERT INTO orders
        (retailer_id, product_id, supplier_id, quantity, unit_price, delivery_fee, total_rwf, delivery_location, payment_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'unpaid') RETURNING *`,
      [req.user.id, product_id, product.supplier_id, requestedQuantity, product.price_rwf, delivery_fee, total_rwf, delivery_location || 'Rwanda']
    );

    res.status(201).json({ message: 'Order placed successfully', order: result.rows[0] });
  } catch (err) {
    if (stockReserved && reservedProductId) {
      await db.query('UPDATE products SET stock = stock + $1 WHERE id = $2', [requestedQuantity, reservedProductId]).catch(() => {});
    }
    console.error('Create order error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

// GET /api/orders - retailer sees their orders
const getMyOrders = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT o.*,
        p.name AS product_name,
        p.emoji,
        s.name AS supplier_name,
        pay.status AS latest_payment_status,
        pay.payment_method,
        pay.provider_code,
        pay.external_id AS deposit_id,
        pay.failure_reason AS payment_failure_reason
       FROM orders o
       JOIN products p ON o.product_id = p.id
       JOIN suppliers s ON o.supplier_id = s.id
       LEFT JOIN LATERAL (
         SELECT *
         FROM payments pay2
         WHERE pay2.order_id = o.id
         ORDER BY pay2.created_at DESC
         LIMIT 1
       ) pay ON true
       WHERE o.retailer_id = $1
       ORDER BY o.created_at DESC`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// GET /api/orders/incoming - manufacturer sees orders for their products
const getIncomingOrders = async (req, res) => {
  try {
    const supplierResult = await db.query(
      'SELECT id FROM suppliers WHERE user_id = $1', [req.user.id]
    );
    if (supplierResult.rows.length === 0) {
      return res.status(404).json({ error: 'Supplier not found' });
    }
    const supplier_id = supplierResult.rows[0].id;

    const result = await db.query(
      `SELECT o.*, p.name as product_name, p.emoji, u.name as retailer_name, u.phone as retailer_phone, u.location as retailer_location
       FROM orders o
       JOIN products p ON o.product_id = p.id
       JOIN users u ON o.retailer_id = u.id
       WHERE o.supplier_id = $1
       ORDER BY o.created_at DESC`,
      [supplier_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// PUT /api/orders/:id/status - manufacturer updates order status
const updateOrderStatus = async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['pending', 'confirmed', 'in_transit', 'delivered', 'cancelled'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  try {
    const result = await db.query(
      `UPDATE orders o SET status = $1, updated_at = NOW()
       FROM suppliers s
       WHERE o.id = $2 AND o.supplier_id = s.id AND s.user_id = $3
       RETURNING o.*`,
      [status, req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json({ message: 'Order status updated', order: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// GET /api/orders/stats - manufacturer dashboard stats
const getStats = async (req, res) => {
  try {
    const supplierResult = await db.query(
      'SELECT id FROM suppliers WHERE user_id = $1', [req.user.id]
    );
    if (supplierResult.rows.length === 0) {
      return res.status(404).json({ error: 'Supplier not found' });
    }
    const supplier_id = supplierResult.rows[0].id;

    const stats = await db.query(
      `SELECT
        COUNT(DISTINCT retailer_id) as active_retailers,
        COUNT(*) as total_orders,
        COALESCE(SUM(total_rwf), 0) as total_revenue,
        COUNT(CASE WHEN status IN ('pending','confirmed') THEN 1 END) as pending_orders
       FROM orders WHERE supplier_id = $1`,
      [supplier_id]
    );
    res.json(stats.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = { createOrder, getMyOrders, getIncomingOrders, updateOrderStatus, getStats };
