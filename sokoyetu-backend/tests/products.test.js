// Product listings: the public catalogue, the manufacturer's own view, editing,
// and the soft delete that hides a listing without destroying it.

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

const NEW_PRODUCT = {
  name: 'Inyange Milk 1L',
  emoji: '🥛',
  price_rwf: 1200,
  unit: 'litre',
  moq: 10,
  stock: 100,
  category: 'Food & beverage',
  description: 'Fresh milk',
};

async function createProduct(token, overrides = {}) {
  const res = await request('POST', '/api/products', { ...NEW_PRODUCT, ...overrides }, token);
  assert.equal(res.status, 201, `create failed: ${JSON.stringify(res.data)}`);
  return res.data;
}

describe('the public catalogue', () => {
  test('GET /products needs no token', async () => {
    const res = await request('GET', '/api/products');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.data));
  });

  test('lists a live product', async () => {
    const manufacturer = await registerUser({ role: 'manufacturer' });
    const product = await createProduct(manufacturer.token);

    const res = await request('GET', '/api/products');

    assert.equal(res.status, 200);
    assert.equal(res.data.length, 1);
    assert.equal(res.data[0].id, product.id);
  });

  test('hides a deactivated product', async () => {
    const manufacturer = await registerUser({ role: 'manufacturer' });
    const product = await createProduct(manufacturer.token);

    await request('DELETE', `/api/products/${product.id}`, undefined, manufacturer.token);

    const res = await request('GET', '/api/products');
    assert.equal(res.data.length, 0);
  });

  test('filters by supplier_id', async () => {
    const first = await registerUser({ role: 'manufacturer' });
    const second = await registerUser({ role: 'manufacturer' });
    await createProduct(first.token, { name: 'First Product' });
    await createProduct(second.token, { name: 'Second Product' });

    const supplier = await request('GET', '/api/suppliers/my', undefined, first.token);
    const res = await request('GET', `/api/products?supplier_id=${supplier.data.id}`);

    assert.equal(res.data.length, 1);
    assert.equal(res.data[0].name, 'First Product');
  });

  test('GET /products/:id returns a live product', async () => {
    const manufacturer = await registerUser({ role: 'manufacturer' });
    const product = await createProduct(manufacturer.token);

    const res = await request('GET', `/api/products/${product.id}`);

    assert.equal(res.status, 200);
    assert.equal(res.data.id, product.id);
  });

  test('GET /products/:id hides a deactivated product', async () => {
    const manufacturer = await registerUser({ role: 'manufacturer' });
    const product = await createProduct(manufacturer.token);

    await request('DELETE', `/api/products/${product.id}`, undefined, manufacturer.token);

    const res = await request('GET', `/api/products/${product.id}`);
    assert.equal(res.status, 404);
  });
});

describe("the manufacturer's own listings", () => {
  test('requires a token', async () => {
    const res = await request('GET', '/api/products/mine');
    assert.equal(res.status, 401);
  });

  test('refuses a retailer', async () => {
    const retailer = await registerUser({ role: 'retailer' });

    const res = await request('GET', '/api/products/mine', undefined, retailer.token);

    assert.equal(res.status, 403);
  });

  test('includes listings hidden from retailers', async () => {
    // This is the whole point of the route: GET /products only returns live
    // listings, so without it a hidden product could never be brought back.
    const manufacturer = await registerUser({ role: 'manufacturer' });
    const product = await createProduct(manufacturer.token);

    await request('DELETE', `/api/products/${product.id}`, undefined, manufacturer.token);

    const res = await request('GET', '/api/products/mine', undefined, manufacturer.token);

    assert.equal(res.status, 200);
    assert.equal(res.data.length, 1);
    assert.equal(res.data[0].available, false);
  });

  test('does not include another manufacturer\'s listings', async () => {
    const first = await registerUser({ role: 'manufacturer' });
    const second = await registerUser({ role: 'manufacturer' });
    await createProduct(first.token);

    const res = await request('GET', '/api/products/mine', undefined, second.token);

    assert.equal(res.data.length, 0);
  });

  test('is not shadowed by the /:id route', async () => {
    // "mine" must be matched as a literal, not parsed as a product id.
    const manufacturer = await registerUser({ role: 'manufacturer' });

    const res = await request('GET', '/api/products/mine', undefined, manufacturer.token);

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.data));
  });
});

describe('creating a product', () => {
  test('creates a listing', async () => {
    const manufacturer = await registerUser({ role: 'manufacturer' });

    const product = await createProduct(manufacturer.token);

    assert.equal(product.name, NEW_PRODUCT.name);
    assert.equal(product.price_rwf, NEW_PRODUCT.price_rwf);
    assert.equal(product.available, true);
  });

  test('refuses a retailer', async () => {
    const retailer = await registerUser({ role: 'retailer' });

    const res = await request('POST', '/api/products', NEW_PRODUCT, retailer.token);

    assert.equal(res.status, 403);
  });

  test('requires a token', async () => {
    const res = await request('POST', '/api/products', NEW_PRODUCT);
    assert.equal(res.status, 401);
  });

  test('rejects a missing name', async () => {
    const manufacturer = await registerUser({ role: 'manufacturer' });

    const res = await request('POST', '/api/products', { ...NEW_PRODUCT, name: '  ' }, manufacturer.token);

    assert.equal(res.status, 400);
  });

  test('rejects a non-positive price', async () => {
    const manufacturer = await registerUser({ role: 'manufacturer' });

    const res = await request('POST', '/api/products', { ...NEW_PRODUCT, price_rwf: 0 }, manufacturer.token);

    assert.equal(res.status, 400);
  });

  test('rejects a negative stock', async () => {
    const manufacturer = await registerUser({ role: 'manufacturer' });

    const res = await request('POST', '/api/products', { ...NEW_PRODUCT, stock: -5 }, manufacturer.token);

    assert.equal(res.status, 400);
  });

  test('rejects a non-integer quantity', async () => {
    const manufacturer = await registerUser({ role: 'manufacturer' });

    const res = await request('POST', '/api/products', { ...NEW_PRODUCT, moq: 1.5 }, manufacturer.token);

    assert.equal(res.status, 400);
  });
});

describe('editing a product', () => {
  test('updates the fields it was given and leaves the rest alone', async () => {
    const manufacturer = await registerUser({ role: 'manufacturer' });
    const product = await createProduct(manufacturer.token);

    const res = await request('PUT', `/api/products/${product.id}`, {
      price_rwf: 1500,
      stock: 42,
    }, manufacturer.token);

    assert.equal(res.status, 200);
    assert.equal(res.data.price_rwf, 1500);
    assert.equal(res.data.stock, 42);
    assert.equal(res.data.name, product.name);
  });

  test('rejects a non-positive price', async () => {
    const manufacturer = await registerUser({ role: 'manufacturer' });
    const product = await createProduct(manufacturer.token);

    const res = await request('PUT', `/api/products/${product.id}`, { price_rwf: -1 }, manufacturer.token);

    assert.equal(res.status, 400);
  });

  test('refuses to edit another manufacturer\'s product', async () => {
    const owner = await registerUser({ role: 'manufacturer' });
    const intruder = await registerUser({ role: 'manufacturer' });
    const product = await createProduct(owner.token);

    const res = await request('PUT', `/api/products/${product.id}`, { price_rwf: 1 }, intruder.token);

    assert.equal(res.status, 404);

    // And the owner's listing is untouched.
    const unchanged = await request('GET', `/api/products/${product.id}`);
    assert.equal(unchanged.data.price_rwf, NEW_PRODUCT.price_rwf);
  });
});

describe('deactivating a product', () => {
  test('hides it without deleting the row', async () => {
    const manufacturer = await registerUser({ role: 'manufacturer' });
    const product = await createProduct(manufacturer.token);

    const res = await request('DELETE', `/api/products/${product.id}`, undefined, manufacturer.token);

    assert.equal(res.status, 200);

    const mine = await request('GET', '/api/products/mine', undefined, manufacturer.token);
    assert.equal(mine.data.length, 1, 'the row must survive a soft delete');
    assert.equal(mine.data[0].available, false);
  });

  test('can be brought back with available: true', async () => {
    const manufacturer = await registerUser({ role: 'manufacturer' });
    const product = await createProduct(manufacturer.token);
    await request('DELETE', `/api/products/${product.id}`, undefined, manufacturer.token);

    await request('PUT', `/api/products/${product.id}`, { available: true }, manufacturer.token);

    const catalogue = await request('GET', '/api/products');
    assert.equal(catalogue.data.length, 1);
  });

  test('refuses to deactivate another manufacturer\'s product', async () => {
    const owner = await registerUser({ role: 'manufacturer' });
    const intruder = await registerUser({ role: 'manufacturer' });
    const product = await createProduct(owner.token);

    const res = await request('DELETE', `/api/products/${product.id}`, undefined, intruder.token);

    assert.equal(res.status, 404);

    const catalogue = await request('GET', '/api/products');
    assert.equal(catalogue.data.length, 1, 'the listing must still be live');
  });
});
