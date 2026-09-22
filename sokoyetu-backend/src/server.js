const express = require('express');
const cors = require('cors');
require('dotenv').config();
const db = require('./db');
const { migrate } = require('./db/migrate');
const { apiLimiter } = require('./middleware/rateLimit');

const app = express();

// Deployed behind a proxy (Railway / Vercel), so trust exactly one hop in order
// to read the real client IP from X-Forwarded-For.
//
// This matters for rate limiting: with trust proxy disabled every request looks
// like it comes from the proxy, so all users would share one bucket. Setting it
// to `true` instead would be worse - clients could spoof X-Forwarded-For and
// bypass the limit entirely.
//
// Override with TRUST_PROXY_HOPS if the deployment topology differs.
app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS || 1));

// Middleware
app.use(cors({
  origin: function(origin, callback) {
    const allowed = [
      'http://localhost:3000',
      'https://sokoyetu-frontend.vercel.app',
      'https://sokoyetu.vercel.app',
      process.env.FRONTEND_URL
    ];
    if (!origin || allowed.includes(origin) || origin.endsWith('.vercel.app')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString('utf8');
  },
}));

// Routes
// Broad rate limit across the API. The auth routes add stricter limiters of
// their own on top of this. The health check sits outside /api so monitoring
// is never throttled.
app.use('/api', apiLimiter);
app.use('/api/auth', require('./routes/auth'));
app.use('/api/suppliers', require('./routes/suppliers'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/payments', require('./routes/payments'));

// Health check
app.get('/', (req, res) => {
  res.json({
    message: 'SokoYetu API is running',
    version: '1.0',
    status: 'ok'
  });
});

app.get('/health', (req, res) => {
  const database = db.getDatabaseStatus ? db.getDatabaseStatus() : { ready: false };
  const healthy = database.ready;

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    database,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// Exported so tests can bind the app to an ephemeral port. Listening only when
// this file is the entry point keeps `npm start` behaving exactly as before, and
// it keeps migrations out of the test run - tests build their own database in
// tests/setup-db.js and require this module rather than spawning it.
const PORT = process.env.PORT || 5000;
if (require.main === module) {
  // Migrations run before the port opens, so a build never serves traffic
  // against a schema it cannot read. Before this existed, shipping a release
  // that read a new column against a database nobody had altered by hand meant
  // every authenticated request failed with a 500.
  //
  // Set MIGRATIONS_ON_STARTUP=false where the database user is not allowed to
  // run DDL. The schema is still verified before listening - it is just not
  // changed - so a mismatch stops the boot either way.
  const applyMigrations = process.env.MIGRATIONS_ON_STARTUP !== 'false';

  migrate({ apply: applyMigrations })
    .then(({ applied }) => {
      if (!applyMigrations) {
        console.log('Migrations skipped (MIGRATIONS_ON_STARTUP=false); schema verified.');
      } else if (applied.length > 0) {
        console.log(`Applied ${applied.length} migration(s): ${applied.join(', ')}`);
      }

      app.listen(PORT, () => {
        console.log(`SokoYetu backend running on port ${PORT}`);
      });
    })
    .catch((err) => {
      console.error('Refusing to start: the database is not ready for this build.');
      console.error(err.message);
      process.exit(1);
    });
}

module.exports = app;
