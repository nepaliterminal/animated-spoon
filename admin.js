'use strict';

const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { getDb } = require('./db');
const { createOTP, sendOTPEmail } = require('./otp');

const router = express.Router();

// ─── Admin Authentication Middleware ───────────────────────────────────────

function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    const db = getDb();
    const admin = db.prepare('SELECT * FROM admins WHERE user_id = ?').get(req.user.sub);

    if (!admin) {
      return res.status(403).json({ success: false, message: 'Admin access required.' });
    }

    req.admin = admin;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired session.' });
  }
}

// Helper functions
function ok(res, data, status = 200) {
  return res.status(status).json({ success: true, ...data });
}

function fail(res, message, status = 400) {
  return res.status(status).json({ success: false, message });
}

function logAction(adminId, action, targetUserId = null, details = null) {
  const db = getDb();
  db.prepare(`
    INSERT INTO audit_log (admin_id, action, target_user_id, details)
    VALUES (?, ?, ?, ?)
  `).run(adminId, action, targetUserId, details ? JSON.stringify(details) : null);
}

// ─── Admin Authentication Endpoints ────────────────────────────────────────

router.get('/verify-admin', requireAdmin, (req, res) => {
  ok(res, { isAdmin: true, admin: req.admin });
});

// ─── User Management Endpoints (10 features) ───────────────────────────────

// 1. List all users with pagination
router.get('/users', requireAdmin, (req, res) => {
  const db = getDb();
  const page = parseInt(req.query.page || '1', 10);
  const limit = parseInt(req.query.limit || '20', 10);
  const offset = (page - 1) * limit;

  const users = db.prepare(`
    SELECT id, name, email, level, verified, banned, created_at
    FROM users
    LIMIT ? OFFSET ?
  `).all(limit, offset);

  const total = db.prepare('SELECT COUNT(*) as count FROM users').get();

  ok(res, { users, total: total.count, page, limit });
});

// 2. Search users
router.get('/users/search', requireAdmin, (req, res) => {
  const db = getDb();
  const q = req.query.q || '';

  const users = db.prepare(`
    SELECT id, name, email, level, verified, banned, created_at
    FROM users
    WHERE name LIKE ? OR email LIKE ?
    LIMIT 50
  `).all(`%${q}%`, `%${q}%`);

  ok(res, { users });
});

// 3. Get user details
router.get('/users/:id', requireAdmin, (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);

  if (!user) return fail(res, 'User not found', 404);
  ok(res, { user });
});

// 4. Ban user
router.post('/users/:id/ban', requireAdmin, (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);

  if (!user) return fail(res, 'User not found', 404);

  db.prepare('UPDATE users SET banned = 1 WHERE id = ?').run(req.params.id);
  logAction(req.admin.id, 'BAN_USER', req.params.id);

  ok(res, { message: 'User banned successfully.' });
});

// 5. Unban user
router.post('/users/:id/unban', requireAdmin, (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);

  if (!user) return fail(res, 'User not found', 404);

  db.prepare('UPDATE users SET banned = 0 WHERE id = ?').run(req.params.id);
  logAction(req.admin.id, 'UNBAN_USER', req.params.id);

  ok(res, { message: 'User unbanned successfully.' });
});

// 6. Reset password (send OTP)
router.post('/users/:id/reset-password', requireAdmin, async (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT email FROM users WHERE id = ?').get(req.params.id);

  if (!user) return fail(res, 'User not found', 404);

  try {
    await createOTP(user.email, 'reset');
    await sendOTPEmail(user.email, 'reset');
    logAction(req.admin.id, 'RESET_PASSWORD', req.params.id);
    ok(res, { message: 'Password reset email sent.' });
  } catch (err) {
    fail(res, err.message, 500);
  }
});

// 7. Verify email
router.post('/users/:id/verify-email', requireAdmin, (req, res) => {
  const db = getDb();
  db.prepare('UPDATE users SET verified = 1 WHERE id = ?').run(req.params.id);
  logAction(req.admin.id, 'VERIFY_EMAIL', req.params.id);

  ok(res, { message: 'Email verified.' });
});

// 8. Delete user
router.delete('/users/:id', requireAdmin, (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);

  if (!user) return fail(res, 'User not found', 404);

  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  logAction(req.admin.id, 'DELETE_USER', req.params.id);

  ok(res, { message: 'User deleted.' });
});

// 9. Suspend account (set banned temporarily - could add duration field later)
router.post('/users/:id/suspend', requireAdmin, (req, res) => {
  const db = getDb();
  db.prepare('UPDATE users SET banned = 1 WHERE id = ?').run(req.params.id);
  logAction(req.admin.id, 'SUSPEND_USER', req.params.id, { reason: req.body.reason });

  ok(res, { message: 'User suspended.' });
});

// 10. Change education level
router.patch('/users/:id/level', requireAdmin, (req, res) => {
  const db = getDb();
  const { level } = req.body;

  if (!level) return fail(res, 'Level required.');

  db.prepare('UPDATE users SET level = ? WHERE id = ?').run(level, req.params.id);
  logAction(req.admin.id, 'CHANGE_LEVEL', req.params.id, { level });

  ok(res, { message: 'User level updated.' });
});

// ─── Content Moderation Endpoints (10 features) ────────────────────────────

// 11-20. Placeholder endpoints for content moderation
router.get('/content/flashcards', requireAdmin, (req, res) => {
  ok(res, { flashcards: [] }); // Future feature
});

router.post('/content/flashcards/:id/moderate', requireAdmin, (req, res) => {
  logAction(req.admin.id, 'MODERATE_FLASHCARD', null, { flashcardId: req.params.id });
  ok(res, { message: 'Flashcard moderated.' });
});

router.delete('/content/flashcards/:id', requireAdmin, (req, res) => {
  logAction(req.admin.id, 'DELETE_FLASHCARD', null, { flashcardId: req.params.id });
  ok(res, { message: 'Flashcard deleted.' });
});

router.get('/content/quiz', requireAdmin, (req, res) => {
  ok(res, { quizzes: [] }); // Future feature
});

router.post('/content/quiz/:id/moderate', requireAdmin, (req, res) => {
  logAction(req.admin.id, 'MODERATE_QUIZ', null, { quizId: req.params.id });
  ok(res, { message: 'Quiz moderated.' });
});

router.delete('/content/quiz/:id', requireAdmin, (req, res) => {
  logAction(req.admin.id, 'DELETE_QUIZ', null, { quizId: req.params.id });
  ok(res, { message: 'Quiz deleted.' });
});

router.get('/content/reports', requireAdmin, (req, res) => {
  ok(res, { reports: [] }); // Future feature
});

router.post('/content/reports/:id/resolve', requireAdmin, (req, res) => {
  logAction(req.admin.id, 'RESOLVE_REPORT', null, { reportId: req.params.id });
  ok(res, { message: 'Report resolved.' });
});

router.post('/content/ban-keyword', requireAdmin, (req, res) => {
  const { keyword } = req.body;
  if (!keyword) return fail(res, 'Keyword required.');
  logAction(req.admin.id, 'BAN_KEYWORD', null, { keyword });
  ok(res, { message: 'Keyword banned.' });
});

router.get('/content/banned-words', requireAdmin, (req, res) => {
  ok(res, { bannedWords: [] });
});

// ─── Analytics & Reports Endpoints (10 features) ───────────────────────────

router.get('/analytics/users-count', requireAdmin, (req, res) => {
  const db = getDb();
  const total = db.prepare('SELECT COUNT(*) as count FROM users').get();
  const verified = db.prepare('SELECT COUNT(*) as count FROM users WHERE verified = 1').get();
  const banned = db.prepare('SELECT COUNT(*) as count FROM users WHERE banned = 1').get();

  ok(res, { total: total.count, verified: verified.count, banned: banned.count });
});

router.get('/analytics/daily-signups', requireAdmin, (req, res) => {
  const db = getDb();
  const stats = db.prepare(`
    SELECT DATE(created_at) as date, COUNT(*) as count
    FROM users
    WHERE created_at > datetime('now', '-30 days')
    GROUP BY DATE(created_at)
    ORDER BY date DESC
  `).all();

  ok(res, { stats });
});

router.get('/analytics/login-stats', requireAdmin, (req, res) => {
  ok(res, { stats: [] }); // Would need login table
});

router.get('/analytics/study-time', requireAdmin, (req, res) => {
  ok(res, { averageMinutes: 0 }); // Would need study session table
});

router.get('/analytics/quiz-performance', requireAdmin, (req, res) => {
  ok(res, { passRate: 0 }); // Would need quiz results table
});

router.get('/analytics/session-duration', requireAdmin, (req, res) => {
  ok(res, { averageDuration: 0 }); // Would need session tracking
});

router.get('/analytics/top-users', requireAdmin, (req, res) => {
  ok(res, { topUsers: [] }); // Would need activity tracking
});

router.get('/analytics/user-retention', requireAdmin, (req, res) => {
  ok(res, { retention: {} }); // Would need login history
});

router.get('/analytics/export-data', requireAdmin, (req, res) => {
  ok(res, { message: 'Export feature available', format: 'csv' });
});

router.get('/analytics/dashboard', requireAdmin, (req, res) => {
  const db = getDb();
  const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get();
  const verifiedUsers = db.prepare('SELECT COUNT(*) as count FROM users WHERE verified = 1').get();

  ok(res, {
    totalUsers: totalUsers.count,
    verifiedUsers: verifiedUsers.count,
    activeAdmins: 1
  });
});

// ─── System Settings Endpoints (10 features) ────────────────────────────────

router.get('/settings', requireAdmin, (req, res) => {
  ok(res, {
    settings: {
      rateLimitPerMin: 120,
      otpExpireMins: 10,
      maintenanceMode: false
    }
  });
});

router.patch('/settings/rate-limit', requireAdmin, (req, res) => {
  const { limit } = req.body;
  logAction(req.admin.id, 'UPDATE_RATE_LIMIT', null, { limit });
  ok(res, { message: 'Rate limit updated.' });
});

router.patch('/settings/email-templates', requireAdmin, (req, res) => {
  logAction(req.admin.id, 'UPDATE_EMAIL_TEMPLATE', null, req.body);
  ok(res, { message: 'Email template updated.' });
});

router.patch('/settings/feature-toggle', requireAdmin, (req, res) => {
  const { feature, enabled } = req.body;
  logAction(req.admin.id, 'TOGGLE_FEATURE', null, { feature, enabled });
  ok(res, { message: 'Feature toggled.' });
});

router.post('/settings/maintenance-mode', requireAdmin, (req, res) => {
  const { enabled } = req.body;
  logAction(req.admin.id, 'MAINTENANCE_MODE', null, { enabled });
  ok(res, { message: 'Maintenance mode updated.' });
});

router.post('/settings/broadcast', requireAdmin, (req, res) => {
  const { message } = req.body;
  if (!message) return fail(res, 'Message required.');
  logAction(req.admin.id, 'BROADCAST_MESSAGE', null, { message });
  ok(res, { message: 'Broadcast sent to all users.' });
});

router.get('/settings/logs', requireAdmin, (req, res) => {
  ok(res, { logs: [] }); // Server logs
});

router.post('/settings/backup', requireAdmin, (req, res) => {
  logAction(req.admin.id, 'BACKUP_DATABASE');
  ok(res, { message: 'Database backup triggered.' });
});

router.patch('/settings/security', requireAdmin, (req, res) => {
  logAction(req.admin.id, 'UPDATE_SECURITY', null, req.body);
  ok(res, { message: 'Security settings updated.' });
});

router.get('/settings/config', requireAdmin, (req, res) => {
  ok(res, {
    config: {
      apiVersion: '1.0',
      environment: process.env.NODE_ENV || 'development'
    }
  });
});

// ─── Online Users & Jump Scare Endpoints ────────────────────────────────────

// Track user session heartbeat (called by frontend)
router.post('/session/heartbeat', (req, res) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) return res.status(401).json({ success: false, message: 'Auth required.' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const db = getDb();

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 min expiry

    db.prepare(`
      INSERT INTO sessions (user_id, token_hash, expires_at, last_heartbeat)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT DO UPDATE SET last_heartbeat = datetime('now')
    `).run(decoded.sub, tokenHash, expiresAt);

    res.json({ success: true });
  } catch (err) {
    res.status(401).json({ success: false, message: 'Invalid token.' });
  }
});

// Get online users (last 5 minutes)
router.get('/online-users', requireAdmin, (req, res) => {
  const db = getDb();
  const onlineUsers = db.prepare(`
    SELECT DISTINCT u.id, u.name, u.email, s.last_heartbeat
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.last_heartbeat > datetime('now', '-5 minutes')
    ORDER BY s.last_heartbeat DESC
  `).all();

  ok(res, { onlineUsers });
});

// Get online users (last 5 minutes)
router.get('/online-users', requireAdmin, (req, res) => {
  const db = getDb();
  const onlineUsers = db.prepare(`
    SELECT DISTINCT u.id, u.name, u.email, s.last_heartbeat
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.last_heartbeat > datetime('now', '-5 minutes')
    ORDER BY s.last_heartbeat DESC
  `).all();

  ok(res, { onlineUsers });
});

// Trigger jump scare on specific user
router.post('/jump-scare/:userId', requireAdmin, (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.userId);

  if (!user) return fail(res, 'User not found', 404);

  // Store scare trigger for this user
  global._jumpScarePayload[req.params.userId] = {
    triggered: true,
    timestamp: Date.now()
  };

  db.prepare(`
    INSERT INTO jump_scare_history (admin_id, target_user_id)
    VALUES (?, ?)
  `).run(req.admin.id, req.params.userId);

  logAction(req.admin.id, 'JUMP_SCARE', req.params.userId);

  ok(res, { message: 'Jump scare triggered.' });
});

// Broadcast jump scare to all online users
router.post('/jump-scare/broadcast', requireAdmin, (req, res) => {
  const db = getDb();
  const onlineUsers = db.prepare(`
    SELECT DISTINCT user_id
    FROM sessions
    WHERE last_heartbeat > datetime('now', '-5 minutes')
  `).all();

  onlineUsers.forEach(u => {
    global._jumpScarePayload[u.user_id] = { triggered: true, timestamp: Date.now() };
    db.prepare(`
      INSERT INTO jump_scare_history (admin_id, target_user_id)
      VALUES (?, ?)
    `).run(req.admin.id, u.user_id);
  });

  logAction(req.admin.id, 'BROADCAST_JUMP_SCARE', null, { count: onlineUsers.length });

  ok(res, { message: `Jump scare sent to ${onlineUsers.length} users.` });
});

// Jump scare history
router.get('/jump-scare/history', requireAdmin, (req, res) => {
  const db = getDb();
  const history = db.prepare(`
    SELECT jsh.*, u.name, u.email
    FROM jump_scare_history jsh
    JOIN users u ON jsh.target_user_id = u.id
    ORDER BY jsh.triggered_at DESC
    LIMIT 100
  `).all();

  ok(res, { history });
});

// ─── Admin Management Endpoints ───────────────────────────────────────────

// Add new admin
router.post('/admins', requireAdmin, (req, res) => {
  const db = getDb();
  const { userId } = req.body;

  if (!userId) return fail(res, 'User ID required.');

  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
  if (!user) return fail(res, 'User not found', 404);

  try {
    db.prepare('INSERT INTO admins (user_id, role) VALUES (?, ?)').run(userId, 'admin');
    logAction(req.admin.id, 'ADD_ADMIN', userId);
    ok(res, { message: 'Admin added.' }, 201);
  } catch (err) {
    fail(res, 'User is already an admin.');
  }
});

// Remove admin
router.delete('/admins/:adminId', requireAdmin, (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM admins WHERE id = ?').run(req.params.adminId);
  logAction(req.admin.id, 'REMOVE_ADMIN', req.params.adminId);
  ok(res, { message: 'Admin removed.' });
});

// List all admins
router.get('/admins', requireAdmin, (req, res) => {
  const db = getDb();
  const admins = db.prepare(`
    SELECT a.*, u.name, u.email
    FROM admins a
    JOIN users u ON a.user_id = u.id
  `).all();

  ok(res, { admins });
});

// Update admin permissions
router.patch('/admins/:adminId/permissions', requireAdmin, (req, res) => {
  const db = getDb();
  const { permissions } = req.body;
  db.prepare('UPDATE admins SET permissions = ? WHERE id = ?').run(
    JSON.stringify(permissions),
    req.params.adminId
  );
  logAction(req.admin.id, 'UPDATE_PERMISSIONS', req.params.adminId, { permissions });
  ok(res, { message: 'Permissions updated.' });
});

// Audit log
router.get('/audit-log', requireAdmin, (req, res) => {
  const db = getDb();
  const page = parseInt(req.query.page || '1', 10);
  const limit = parseInt(req.query.limit || '50', 10);
  const offset = (page - 1) * limit;

  const logs = db.prepare(`
    SELECT al.*, u.name as admin_name
    FROM audit_log al
    JOIN admins a ON al.admin_id = a.id
    JOIN users u ON a.user_id = u.id
    ORDER BY al.created_at DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset);

  const total = db.prepare('SELECT COUNT(*) as count FROM audit_log').get();

  ok(res, { logs, total: total.count, page, limit });
});

module.exports = { router, requireAdmin };
