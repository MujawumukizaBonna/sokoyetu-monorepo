// Orders: placing one, stock reservation, the retailer's and manufacturer's
// views, status changes, and the role guards around all of it.

require('./env');

const { test, before, after, beforeEach, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  startServer,
  stopServer,
  truncateAll,
  request,
  registerUser,
} = require('./helpers');

before(startServer);
after(stopServer);
beforeEach(truncateAll);

const DELIVERY_FEE = 1500;

async function setupProduct(overrides = {}) {
  const manufacturer = await registerUser({ role: 'manufacturer' });
  const retailer = await registerUser({ role: 'retailer' });

  const created = await request('POST', '/api/products', {
    name: 'Inyange Milk 1L',
    emoji: '🥛',
    price_rwf: 1200,
    unit: 'litre',
    moq: 10,
    stock: 100,
    category: 'Food & beverage',
    ...overrides,
  }, manufacturer.token);

  assert.equal(created.status, 201);

  return { manufacturer, retailer, product: created.data };
}

async function placeOrder(retailer, product, quantity = 10) {
  return request('POST', '/api/orders', {
    product_id: product.id,
    quantity,
    delivery_location: 'Kigali',
  }, retailer.token);
}

describe('placing an order', () => {
  test('creates the order and reserves stock', async () => {
    const { retailer, product } = await setupProduct();

    const res = await placeOrder(retailer, product, 10);

    assert.equal(res.status, 201);
    assert.equal(res.data.order.quantity, 10);
    assert.equal(res.data.order.unit_price, 1200);
    assert.equal(res.data.order.total_rwf, 1200 * 10 + DELIVERY_FEE);
    assert.equal(res.data.order.status, 'pending');
    assert.equal(res.data.order.payment_status, 'unpaid');

    const after = await request('GET', `/api/products/${product.id}`);
    assert.equal(after.data.stock, 90, 'stock should have been reserved');
  });

  test('rejects a quantity below the minimum order quantity', async () => {
    const { retailer, product } = await setupProduct({ moq: 20 });

    const res = await placeOrder(retailer, product, 5);

    assert.equal(res.status, 400);
    assert.match(res.data.error, /minimum order quantity/i);
  });

  test('rejects a quantity above the available stock', async () => {
    const { retailer, product } = await setupProduct({ stock: 15 });

    const res = await placeOrder(retailer, product, 50);

    assert.equal(res.status, 400);
    assert.match(res.data.error, /available/i);
  });

  test('rejects a missing or invalid quantity', async () => {
    const { retailer, product } = await setupProduct();

    const missing = await request('POST', '/api/orders', {
      product_id: product.id,
    }, retailer.token);
    const zero = await placeOrder(retailer, product, 0);
    const fractional = await placeOrder(retailer, product, 1.5);

    assert.equal(missing.status, 400);
    assert.equal(zero.status, 400);
    assert.equal(fractional.status, 400);
  });

  test('rejects an unknown product', async () => {
    const { retailer } = await setupProduct();

    const res = await request('POST', '/api/orders', {
      product_id: '00000000-0000-0000-0000-000000000000',
      quantity: 10,
    }, retailer.token);

    assert.equal(res.status, 404);
  });

  test('rejects a product that has been deactivated', async () => {
    const { manufacturer, retailer, product } = await setupProduct();
    await request('DELETE', `/api/products/${product.id}`, undefined, manufacturer.token);

    const res = await placeOrder(retailer, product, 10);

    assert.equal(res.status, 404);
  });

  test('refuses a manufacturer', async () => {
    const { manufacturer, product } = await setupProduct();

    const res = await request('POST', '/api/orders', {
      product_id: product.id,
      quantity: 10,
    }, manufacturer.token);

    assert.equal(res.status, 403);
  });

  test('requires a token', async () => {
    const { product } = await setupProduct();

    const res = await request('POST', '/api/orders', { product_id: product.id, quantity: 10 });

    assert.equal(res.status, 401);
  });
});

describe("the retailer's orders", () => {
  test('lists the order they placed', async () => {
    const { retailer, product } = await setupProduct();
    await placeOrder(retailer, product, 10);

    const res = await request('GET', '/api/orders/my', undefined, retailer.token);

    assert.equal(res.status, 200);
    assert.equal(res.data.length, 1);
    assert.equal(res.data[0].product_name, 'Inyange Milk 1L');
  });

  test('does not show another retailer\'s orders', async () => {
    const { retailer, product } = await setupProduct();
    const otherRetailer = await registerUser({ role: 'retailer' });
    await placeOrder(retailer, product, 10);

    const res = await request('GET', '/api/orders/my', undefined, otherRetailer.token);

    assert.equal(res.data.length, 0);
  });

  test('refuses a manufacturer', async () => {
    const { manufacturer } = await setupProduct();

    const res = await request('GET', '/api/orders/my', undefined, manufacturer.token);

    assert.equal(res.status, 403);
  });
});

describe("the manufacturer's orders", () => {
  test('lists an incoming order', async () => {
    const { manufacturer, retailer, product } = await setupProduct();
    await placeOrder(retailer, product, 10);

    const res = await request('GET', '/api/orders/incoming', undefined, manufacturer.token);

    assert.equal(res.status, 200);
    assert.equal(res.data.length, 1);
    assert.equal(res.data[0].retailer_name, retailer.user.name);
  });

  test('refuses a retailer', async () => {
    const { retailer } = await setupProduct();

    const res = await request('GET', '/api/orders/incoming', undefined, retailer.token);

    assert.equal(res.status, 403);
  });

  test('stats count the order', async () => {
    const { manufacturer, retailer, product } = await setupProduct();
    await placeOrder(retailer, product, 10);

    const res = await request('GET', '/api/orders/stats', undefined, manufacturer.token);

    assert.equal(res.status, 200);
    assert.equal(Number(res.data.total_orders), 1);
    assert.equal(Number(res.data.active_retailers), 1);
    assert.equal(Number(res.data.pending_orders), 1);
    assert.equal(Number(res.data.total_revenue), 1200 * 10 + DELIVERY_FEE);
  });
});

describe('updating an order status', () => {
  test('the manufacturer can advance it', async () => {
    const { manufacturer, retailer, product } = await setupProduct();
    const placed = await placeOrder(retailer, product, 10);

    const res = await request('PUT', `/api/orders/${placed.data.order.id}/status`, {
      status: 'confirmed',
    }, manufacturer.token);

    assert.equal(res.status, 200);
    assert.equal(res.data.order.status, 'confirmed');
  });

  test('rejects an unknown status', async () => {
    const { manufacturer, retailer, product } = await setupProduct();
    const placed = await placeOrder(retailer, product, 10);

    const res = await request('PUT', `/api/orders/${placed.data.order.id}/status`, {
      status: 'shipped-to-the-moon',
    }, manufacturer.token);

    assert.equal(res.status, 400);
  });

  test('refuses a different manufacturer', async () => {
    const { retailer, product } = await setupProduct();
    const intruder = await registerUser({ role: 'manufacturer' });
    const placed = await placeOrder(retailer, product, 10);

    const res = await request('PUT', `/api/orders/${placed.data.order.id}/status`, {
      status: 'delivered',
    }, intruder.token);

    assert.equal(res.status, 404);
  });

  test('refuses a retailer', async () => {
    const { retailer, product } = await setupProduct();
    const placed = await placeOrder(retailer, product, 10);

    const res = await request('PUT', `/api/orders/${placed.data.order.id}/status`, {
      status: 'delivered',
    }, retailer.token);

    assert.equal(res.status, 403);
  });
});
