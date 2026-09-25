'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const { app, db, initDatabase } = require('./server');

function request(server, pathname, options = {}) {
  return new Promise((resolve, reject) => {
    const address = server.address();
    const req = http.request({
      hostname: '127.0.0.1',
      port: address.port,
      path: pathname,
      method: options.method || 'GET',
      headers: options.body ? { 'Content-Type': 'application/json' } : {}
    }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(body); } catch {}
        resolve({ status: res.statusCode, body, json });
      });
    });
    req.on('error', reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

(async () => {
  await initDatabase();
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

  try {
    const health = await request(server, '/api/health');
    assert.equal(health.status, 200);
    assert.equal(health.json.ok, true);

    const products = await request(server, '/api/products');
    assert.equal(products.status, 200);
    assert.ok(Array.isArray(products.json.products));
    assert.ok(products.json.products.length > 0);

    const product = products.json.products[0];
    const filtered = await request(server, `/api/products?category=${encodeURIComponent(product.category)}`);
    assert.equal(filtered.status, 200);
    assert.ok(filtered.json.products.every(item => item.category === product.category));

    const order = await request(server, '/api/orders', {
      method: 'POST',
      body: {
        customer_name: 'Jane Doe',
        email: 'jane@example.com',
        address: '123 Test Street',
        items: [{ id: product.id, qty: 2 }]
      }
    });
    assert.equal(order.status, 201);
    assert.equal(order.json.success, true);
    assert.ok(order.json.orderId);
    assert.equal(order.json.total, Number((Number(product.price) * 2).toFixed(2)));

    const invalid = await request(server, '/api/orders', {
      method: 'POST',
      body: { customer_name: 'X', email: 'bad-email', address: 'Y', items: [{ id: product.id, qty: 1 }] }
    });
    assert.equal(invalid.status, 400);

    console.log('All integration tests passed.');
  } finally {
    await new Promise(resolve => server.close(resolve));
    db.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
