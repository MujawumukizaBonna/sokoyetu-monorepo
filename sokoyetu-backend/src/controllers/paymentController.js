const db = require('../db');
const config = require('../config/pawapay');
const { verifyCallbackSignature } = require('../services/pawapaySignature');
const {
  createDepositId,
  initiateDeposit,
  checkDepositStatus,
  getActiveConfiguration,
  getAvailability,
  predictProvider,
  createPaymentPageSession,
  normalizePaymentStatus,
} = require('../services/pawapayService');

const PAYMENT_METHODS = new Set(['mobile_money', 'credit_card']);
const countryToCurrency = {
  RWA: 'RWF',
  ZMB: 'ZMW',
  GHA: 'GHS',
  NGA: 'NGN',
  COG: 'XAF',
  BEN: 'XOF',
  BFA: 'XOF',
  MOZ: 'MZN',
  MWI: 'MWK',
  SEN: 'XOF',
};

const normalizeCountry = (value) => {
  if (!value) return config.defaultCountry;
  const trimmed = String(value).trim().toUpperCase();
  if (trimmed.length === 3) return trimmed;
  if (/RWANDA/i.test(value)) return 'RWA';
  if (/ZAMB/i.test(value)) return 'ZMB';
  if (/GHA/i.test(value)) return 'GHA';
  return config.defaultCountry;
};

const getCurrencyForCountry = (country) => countryToCurrency[country] || config.defaultCurrency;

const buildProviderSelection = async ({ country, phoneNumber, providerCode }) => {
  if (providerCode) {
    return { provider: providerCode, phoneNumber };
  }

  if (!phoneNumber) {
    return null;
  }

  const prediction = await predictProvider({ phoneNumber });
  if (country && prediction.country && prediction.country !== country) {
    throw Object.assign(new Error(`Phone number belongs to ${prediction.country}, not ${country}`), { status: 400 });
  }

  return {
    provider: prediction.provider,
    phoneNumber: prediction.phoneNumber,
  };
};

const loadOrder = async (orderId, retailerId) => {
  const result = await db.query(
    `SELECT o.*, p.name AS product_name, p.price_rwf, p.supplier_id
     FROM orders o
     JOIN products p ON p.id = o.product_id
     WHERE o.id = $1 AND o.retailer_id = $2`,
    [orderId, retailerId]
  );

  return result.rows[0] || null;
};

const createDeposit = async (req, res) => {
  const {
    order_id,
    phone_number,
    provider_code,
    payment_method = 'mobile_money',
    country,
    use_payment_page = false,
    return_url,
  } = req.body;

  if (!order_id) {
    return res.status(400).json({ error: 'Order id is required' });
  }

  if (!PAYMENT_METHODS.has(payment_method)) {
    return res.status(400).json({ error: 'Unsupported payment method' });
  }

  if (payment_method === 'credit_card') {
    return res.status(400).json({
      error: 'Credit card is not available in the pawaPay sandbox. Use mobile money for this integration.',
    });
  }

  if (!phone_number) {
    return res.status(400).json({ error: 'Phone number is required for mobile money payments' });
  }

  try {
    const order = await loadOrder(order_id, req.user.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    if (order.payment_status === 'paid') {
      return res.status(409).json({ error: 'This order has already been paid' });
    }
    if (order.status === 'cancelled') {
      return res.status(409).json({ error: 'Cancelled orders cannot be paid' });
    }

    const resolvedCountry = normalizeCountry(country || req.body.delivery_country || req.body.location || config.defaultCountry);
    const depositId = createDepositId();
    const currency = getCurrencyForCountry(resolvedCountry);
    const clientReferenceId = `ORDER-${order.id.slice(0, 8).toUpperCase()}`;
    const providerSelection = await buildProviderSelection({
      country: resolvedCountry,
      phoneNumber: phone_number,
      providerCode: provider_code,
    });

    if (!providerSelection?.provider) {
      return res.status(400).json({ error: 'Unable to determine a provider for this phone number' });
    }

    const existingPayment = await db.query(
      `SELECT * FROM payments
       WHERE order_id = $1 AND status IN ('pending', 'processing')
       ORDER BY created_at DESC LIMIT 1`,
      [order.id]
    );
    if (existingPayment.rows.length > 0) {
      return res.status(200).json({
        message: 'A payment is already in progress for this order',
        order,
        payment: existingPayment.rows[0],
      });
    }

    const paymentInsert = await db.query(
      `INSERT INTO payments
        (order_id, retailer_id, amount, currency, payment_method, phone_number, provider_code, status, external_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8)
       RETURNING *`,
      [
        order.id,
        req.user.id,
        order.total_rwf,
        currency,
        payment_method,
        providerSelection.phoneNumber,
        providerSelection.provider,
        depositId,
      ]
    );

    let gatewayResponse;
    if (use_payment_page) {
      const session = await createPaymentPageSession({
        depositId,
        returnUrl: return_url || config.callbackUrl || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/orders`,
        amount: order.total_rwf,
        currency,
        phoneNumber: providerSelection.phoneNumber,
        country: resolvedCountry,
        reason: `Order ${order.id.slice(0, 8)}`,
        customerMessage: `Payment for ${order.product_name}`,
        metadata: [{ orderId: order.id }],
      });
      gatewayResponse = session;
    } else {
      gatewayResponse = await initiateDeposit({
        depositId,
        amount: order.total_rwf,
        currency,
        phoneNumber: providerSelection.phoneNumber,
        provider: providerSelection.provider,
        clientReferenceId,
        customerMessage: `Payment for ${order.product_name}`,
        metadata: [{ orderId: order.id }],
        country: resolvedCountry,
      });
    }

    const paymentStatus = normalizePaymentStatus(gatewayResponse.status);
    await db.query(
      'UPDATE payments SET status = $1, updated_at = NOW() WHERE id = $2',
      [paymentStatus, paymentInsert.rows[0].id]
    );

    res.status(201).json({
      message: 'Payment initiated',
      order,
      payment: {
        ...paymentInsert.rows[0],
        status: paymentStatus,
        gateway: gatewayResponse,
      },
    });
  } catch (err) {
    console.error('Create deposit error:', err.message);
    res.status(err.status || 500).json({
      error: err.message || 'Unable to start payment',
      details: err.details || null,
    });
  }
};

const syncDepositStatus = async (req, res) => {
  const { depositId } = req.params;

  try {
    const local = await db.query(
      `SELECT p.*, o.id AS order_id
       FROM payments p
       LEFT JOIN orders o ON o.id = p.order_id
       WHERE p.external_id = $1 AND p.retailer_id = $2`,
      [depositId, req.user.id]
    );

    if (local.rows.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    let gateway = null;
    try {
      gateway = await checkDepositStatus(depositId);
    } catch (err) {
      gateway = null;
    }

    if (gateway?.status === 'FOUND' && gateway.data) {
      const status = normalizePaymentStatus(gateway.data.status);
      await db.query(
        `UPDATE payments
         SET status = $1,
             provider_reference = COALESCE($2, provider_reference),
             failure_reason = COALESCE($3, failure_reason),
             updated_at = NOW()
         WHERE external_id = $4`,
        [
          status,
          gateway.data.providerTransactionId || null,
          gateway.data.failureReason?.failureMessage || gateway.data.failureReason?.failureCode || null,
          depositId,
        ]
      );

      if (local.rows[0].order_id && status === 'completed') {
        await db.query(
          'UPDATE orders SET payment_status = $1, updated_at = NOW() WHERE id = $2',
          ['paid', local.rows[0].order_id]
        );
      }
    }

    const refreshed = await db.query('SELECT * FROM payments WHERE external_id = $1', [depositId]);
    res.json({
      payment: refreshed.rows[0],
      gateway,
    });
  } catch (err) {
    console.error('Sync deposit error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

const handleDepositCallback = async (req, res) => {
  const payload = req.body || {};
  const depositId = payload.depositId;

  if (!depositId) {
    return res.status(400).json({ error: 'depositId is required' });
  }

  try {
    await verifyCallbackSignature(req);

    const paymentResult = await db.query(
      'SELECT * FROM payments WHERE external_id = $1',
      [depositId]
    );

    if (paymentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    const status = normalizePaymentStatus(payload.status);
    await db.query(
      `UPDATE payments
       SET status = $1,
           provider_reference = COALESCE($2, provider_reference),
           failure_reason = COALESCE($3, failure_reason),
           updated_at = NOW()
       WHERE external_id = $4`,
      [
        status,
        payload.providerTransactionId || null,
        payload.failureReason?.failureMessage || payload.failureReason?.failureCode || null,
        depositId,
      ]
    );

    if (paymentResult.rows[0].order_id && status === 'completed') {
      await db.query(
        'UPDATE orders SET payment_status = $1, updated_at = NOW() WHERE id = $2',
        ['paid', paymentResult.rows[0].order_id]
      );
    }

    if (paymentResult.rows[0].order_id && status === 'failed') {
      await db.query(
        'UPDATE orders SET payment_status = $1, updated_at = NOW() WHERE id = $2',
        ['unpaid', paymentResult.rows[0].order_id]
      );
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('Payment callback error:', err.message);
    res.status(err.status || 500).json({ error: err.message || 'Server error' });
  }
};

const listProviders = async (req, res) => {
  const country = normalizeCountry(req.query.country);

  if (!config.apiToken) {
    return res.status(503).json({
      error: 'Mobile Money is not configured yet. Ask the SokoYetu administrator to add the pawaPay credentials.',
    });
  }

  try {
    const [activeConfiguration, availability] = await Promise.allSettled([
      getActiveConfiguration({ country, operationType: 'DEPOSIT' }),
      getAvailability({ country, operationType: 'DEPOSIT' }),
    ]);

    res.json({
      country,
      activeConfiguration: activeConfiguration.status === 'fulfilled' ? activeConfiguration.value : null,
      availability: availability.status === 'fulfilled' ? availability.value : null,
    });
  } catch (err) {
    console.error('List providers error:', err.message);
    res.status(500).json({ error: 'Unable to load providers' });
  }
};

const predict = async (req, res) => {
  const phoneNumber = req.body.phoneNumber || req.body.phone_number;
  if (!phoneNumber) {
    return res.status(400).json({ error: 'Phone number is required' });
  }

  try {
    const prediction = await predictProvider({ phoneNumber });
    res.json(prediction);
  } catch (err) {
    console.error('Predict provider error:', err.message);
    res.status(err.status || 500).json({
      error: err.message || 'Unable to predict provider',
      details: err.details || null,
    });
  }
};

module.exports = {
  createDeposit,
  syncDepositStatus,
  handleDepositCallback,
  listProviders,
  predict,
};
