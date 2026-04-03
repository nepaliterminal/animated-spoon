'use strict';

require('dotenv').config();

// Fail immediately if critical env vars are missing
const required = ['JWT_SECRET', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'];
const missing  = required.filter(k => !process.env[k]);
if (missing.length) {
  console.error(`\n❌  Missing required environment variables:\n    ${missing.join(', ')}`);
  console.error('\n    Fix: copy .env.example → .env and fill in every value.\n');
  process.exit(1);
}

const express   = require('express');
const cors      = require('cors');
const rateLimit = require('express-rate-limit');
const { getDb } = require('./db');
const { router: authRouter } = require('./auth');
const { router: adminRouter } = require('./admin');
const { verifyTransporter, sendTestEmail, sendWeeklyReport } = require('./otp');

const app  = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(cors({
  origin:      process.env.FRONTEND_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));

app.use(express.json({ limit: '64kb' }));

// Global rate limit: 120 req / 15 min per IP
app.use(rateLimit({
  windowMs:       15 * 60 * 1000,
  max:            120,
  standardHeaders: true,
  legacyHeaders:  false,
  message: { success: false, message: 'Too many requests. Please slow down.' },
}));

// Stricter limit on auth endpoints: 15 req / 15 min per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      15,
  message:  { success: false, message: 'Too many auth attempts. Please wait a few minutes.' },
});
app.use('/auth', authLimiter);

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use('/auth', authRouter);
app.use('/admin', adminRouter);

// SMTP smoke-test — send a real email to verify the pipeline works end-to-end.
// Usage: GET /auth/test-email?to=youraddress@example.com
// IMPORTANT: Remove or password-protect this in production.
app.get('/auth/test-email', async (req, res) => {
  const to = req.query.to;
  if (!to) return res.status(400).json({ success: false, message: 'Add ?to=your@email.com' });
  try {
    const info = await sendTestEmail(to);
    res.json({ success: true, message: `Test email sent to ${to}`, messageId: info.messageId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/auth/send-weekly-report', async (req, res) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) return res.status(401).json({ success: false, message: 'Authentication required.' });

  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { getDb } = require('./db');
    const db = getDb();

    const user = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(decoded.sub);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    const info = await sendWeeklyReport(user);
    return res.json({ success: true, message: 'Weekly report sent!', messageId: info.messageId });
  } catch (err) {
    console.error('[weekly-report] ERROR:', err.message, err);
    return res.status(500).json({ success: false, message: `Server error: ${err.message}` });
  }
});

// ─── Session Heartbeat & Jump Scare Check (Public Routes) ────────────────

const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// Track user session heartbeat (called by frontend every 30 seconds)
app.post('/session/heartbeat', (req, res) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) return res.status(401).json({ success: false, message: 'Auth required.' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const db = getDb();

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    db.prepare(`
      INSERT INTO sessions (user_id, token_hash, expires_at, last_heartbeat)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(user_id) DO UPDATE SET last_heartbeat = datetime('now')
    `).run(decoded.sub, tokenHash, expiresAt);

    res.json({ success: true });
  } catch (err) {
    res.status(401).json({ success: false, message: 'Invalid token.' });
  }
});

// Get pending jump scare for current user
let _jumpScarePayload = {}; // In-memory store (would use Redis in production)

app.get('/check-jump-scare', (req, res) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) return res.status(401).json({ success: false });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const scare = _jumpScarePayload[decoded.sub];

    if (scare) {
      delete _jumpScarePayload[decoded.sub];
      res.json({ success: true, jumpScare: true });
    } else {
      res.json({ success: true, jumpScare: false });
    }
  } catch {
    res.status(401).json({ success: false });
  }
});

// Store reference for admin.js to access
global._jumpScarePayload = _jumpScarePayload;



app.get('/health', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// 404 catch-all
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint not found.' });
});

// Unhandled error — keep stack traces out of API responses
app.use((err, _req, res, _next) => {
  console.error('[unhandled error]', err);
  res.status(500).json({ success: false, message: 'Internal server error.' });
});

// ─── Startup ──────────────────────────────────────────────────────────────────

async function start() {
  // Init SQLite (creates tables on first run)
  getDb();
  console.log('✅  Database ready');

  // Verify SMTP credentials before accepting traffic
  // If this throws, the server won't start — which is exactly what we want.
  try {
    await verifyTransporter();
  } catch (err) {
    console.error('\n❌  SMTP verification failed:', err.message);
    console.error('    Fix your .env SMTP settings and restart.\n');
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`\n🚀  KrynoLux backend running on http://localhost:${PORT}`);
    console.log(`\n    Endpoints:`);
    console.log(`      POST   /auth/register`);
    console.log(`      POST   /auth/login`);
    console.log(`      POST   /auth/verify-otp`);
    console.log(`      POST   /auth/resend-otp`);
    console.log(`      POST   /auth/forgot-password`);
    console.log(`      POST   /auth/reset-password`);
    console.log(`      GET    /auth/me          (requires Bearer token)`);
    console.log(`      GET    /auth/test-email?to=you@example.com`);
    console.log(`      GET    /health`);
    console.log(`\n    SMTP:   ${process.env.SMTP_USER} @ ${process.env.SMTP_HOST}`);
    console.log(`    CORS:   ${process.env.FRONTEND_ORIGIN || 'http://localhost:3000'}\n`);
  });
}

start();
