'use strict';

const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const DB_PATH = path.join(ROOT, 'borsha.db');

app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(ROOT, 'public'), { maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0 }));

const db = new sqlite3.Database(DB_PATH);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(error) {
      if (error) reject(error);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => error ? reject(error) : resolve(row));
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows));
  });
}

async function initDatabase() {
  await run(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price REAL NOT NULL CHECK(price >= 0),
    category TEXT,
    image TEXT,
    description TEXT
  )`);
  await run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT NOT NULL,
    email TEXT NOT NULL,
    address TEXT NOT NULL,
    total REAL NOT NULL CHECK(total >= 0),
    items TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  const row = await get('SELECT COUNT(*) AS count FROM products');
  if (row.count > 0) return;

  const seed = [
    ['Silk Elegance Saree', 120, 'Sarees', 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=800', 'Exquisite traditional silk saree with intricate zari work.'],
    ['Modern Fusion Kurti', 45, 'Kurtis', 'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=800', 'Comfortable yet stylish cotton kurti for everyday wear.'],
    ['Bridal Lehenga Choli', 350, 'Lehengas', 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?w=800', 'Stunning red bridal lehenga with heavy embroidery and stones.'],
    ['Designer Velvet Shawl', 85, 'Accessories', 'https://images.unsplash.com/photo-1606760227091-3dd870d97f1d?w=800', 'Luxurious velvet shawl to keep you warm and elegant.'],
    ['Royal Banarasi Saree', 210, 'Sarees', 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?w=800', 'Authentic Banarasi silk saree with rich brocade.'],
    ['Embroidered Anarkali Suit', 130, 'Kurtis', 'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=800', 'Graceful flowing Anarkali suit with delicate thread work.']
  ];
  for (const item of seed) await run('INSERT INTO products (name, price, category, image, description) VALUES (?, ?, ?, ?, ?)', item);
}

app.get('/api/health', async (_req, res) => {
  try {
    await get('SELECT 1 AS ok');
    res.json({ ok: true, service: 'borsha-fashion' });
  } catch (error) {
    res.status(503).json({ ok: false, error: error.message });
  }
});

app.get('/api/products', async (req, res, next) => {
  try {
    const category = String(req.query.category || 'All').trim();
    const rows = category && category !== 'All'
      ? await all('SELECT * FROM products WHERE category = ? ORDER BY id DESC', [category])
      : await all('SELECT * FROM products ORDER BY id DESC');
    res.json({ products: rows });
  } catch (error) {
    next(error);
  }
});

app.post('/api/orders', async (req, res, next) => {
  try {
    const body = req.body || {};
    const customerName = String(body.customer_name || '').trim();
    const email = String(body.email || '').trim();
    const address = String(body.address || '').trim();
    const items = Array.isArray(body.items) ? body.items : [];

    if (!customerName || !email || !address || !items.length) {
      return res.status(400).json({ error: 'Missing required order fields' });
    }
    if (customerName.length > 100 || email.length > 254 || address.length > 1000) {
      return res.status(400).json({ error: 'Order fields are too long' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    const normalized = [];
    for (const raw of items.slice(0, 50)) {
      const id = Number(raw?.id);
      const qty = Math.max(1, Math.min(20, Number(raw?.qty) || 0));
      if (!Number.isInteger(id) || qty < 1) continue;
      const product = await get('SELECT id, name, price FROM products WHERE id = ?', [id]);
      if (product) normalized.push({ id: product.id, name: product.name, price: Number(product.price), qty });
    }

    if (!normalized.length) return res.status(400).json({ error: 'No valid products in order' });

    const total = Number(normalized.reduce((sum, item) => sum + item.price * item.qty, 0).toFixed(2));
    const result = await run(
      'INSERT INTO orders (customer_name, email, address, total, items) VALUES (?, ?, ?, ?, ?)',
      [customerName, email, address, total, JSON.stringify(normalized)]
    );

    res.status(201).json({ success: true, orderId: result.lastID, total });
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  if (res.headersSent) return;
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  await initDatabase();
  if (require.main === module) {
    app.listen(PORT, '0.0.0.0', () => console.log(`Borsha Fashion running on port ${PORT}`));
  }
}

if (require.main === module) {
  start().catch(error => {
    console.error('Database initialization failed:', error);
    process.exitCode = 1;
  });
}

module.exports = { app, db, initDatabase };
