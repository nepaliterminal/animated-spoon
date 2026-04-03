'use strict';

const express    = require('express');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const validator  = require('validator');
const { getDb }  = require('./db');
const { createOTP, verifyOTP, sendOTPEmail } = require('./otp');

const router = express.Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ok(res, data, status = 200) {
  return res.status(status).json({ success: true, ...data });
}

function fail(res, message, status = 400, code = null) {
  return res.status(status).json({ success: false, message, ...(code && { code }) });
}

function signToken(userId) {
  return jwt.sign(
    { sub: userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

// Middleware — require a valid JWT on protected routes
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return fail(res, 'Authentication required.', 401);
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return fail(res, 'Invalid or expired session. Please sign in again.', 401);
  }
}

// Centralised error handler — maps known error codes to HTTP responses
function handleError(res, err, context) {
  // OTP / email errors — tell the client clearly what happened
  const clientErrors = {
    OTP_LIMIT:         [429, err.message],
    OTP_NOT_FOUND:     [400, err.message],
    OTP_EXPIRED:       [400, err.message],
    OTP_WRONG:         [400, err.message],
    EMAIL_SEND_FAILED: [503, err.message],
  };
  if (clientErrors[err.code]) {
    return fail(res, clientErrors[err.code][1], clientErrors[err.code][0], err.code);
  }
  // Unexpected errors — log server-side, return generic message
  console.error(`[${context}]`, err);
  return fail(res, 'Something went wrong. Please try again.', 500);
}

// ─── POST /auth/register ──────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, level } = req.body;

    if (!name || name.trim().length < 2)
      return fail(res, 'Please enter your full name (at least 2 characters).');
    if (!email || !validator.isEmail(email))
      return fail(res, 'Please enter a valid email address.');
    if (!password || password.length < 8)
      return fail(res, 'Password must be at least 8 characters.');
    if (!level)
      return fail(res, 'Please select your education level.');

    const db       = getDb();
    const cleanEmail = email.trim().toLowerCase();
    const existing = db.prepare('SELECT id, verified FROM users WHERE email = ?').get(cleanEmail);

    if (existing?.verified)
      return fail(res, 'An account with this email already exists. Please sign in.');

    const hash = await bcrypt.hash(password, 12);

    if (existing && !existing.verified) {
      // Re-registration: update the pending row
      db.prepare('UPDATE users SET name=?, password=?, level=? WHERE id=?')
        .run(name.trim(), hash, level, existing.id);
    } else {
      db.prepare('INSERT INTO users (name, email, password, level, verified) VALUES (?,?,?,?,0)')
        .run(name.trim(), cleanEmail, hash, level);
    }

    const code = await createOTP(cleanEmail, 'verify');
    await sendOTPEmail(cleanEmail, code, 'verify');  // throws EMAIL_SEND_FAILED on SMTP error

    return ok(res, { message: 'Verification code sent! Check your inbox.' }, 201);
  } catch (err) {
    return handleError(res, err, 'register');
  }
});

// ─── POST /auth/verify-otp ────────────────────────────────────────────────────
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, code, purpose = 'verify' } = req.body;

    if (!email || !validator.isEmail(email))
      return fail(res, 'Invalid email address.');
    if (!code || code.replace(/\s/g, '').length !== parseInt(process.env.OTP_DIGITS || '6', 10))
      return fail(res, 'Please enter the complete verification code.');

    const cleanCode  = code.replace(/\s/g, '');
    const cleanEmail = email.trim().toLowerCase();

    await verifyOTP(cleanEmail, cleanCode, purpose);  // throws OTP_* on failure

    const db = getDb();

    if (purpose === 'verify') {
      const user = db.prepare('SELECT id, name, email, level FROM users WHERE email = ?').get(cleanEmail);
      if (!user) return fail(res, 'Account not found.', 404);

      db.prepare('UPDATE users SET verified = 1 WHERE id = ?').run(user.id);

      return ok(res, {
        message: 'Email verified! Welcome to KrynoLux. 🎉',
        token:   signToken(user.id),
        user:    { id: user.id, name: user.name, email: user.email, level: user.level },
      });
    }

    if (purpose === 'reset') {
      const user = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
      if (!user) return fail(res, 'Account not found.', 404);

      // Short-lived (15 min) token scoped only to password reset
      const resetToken = jwt.sign(
        { sub: user.id, purpose: 'reset' },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
      );
      return ok(res, { message: 'Code verified. Set your new password.', resetToken });
    }

    return fail(res, 'Unknown purpose.');
  } catch (err) {
    return handleError(res, err, 'verify-otp');
  }
});

// ─── POST /auth/resend-otp ────────────────────────────────────────────────────
router.post('/resend-otp', async (req, res) => {
  try {
    const { email, purpose = 'verify' } = req.body;

    if (!email || !validator.isEmail(email))
      return fail(res, 'Invalid email address.');

    const cleanEmail = email.trim().toLowerCase();
    const db         = getDb();
    const user       = db.prepare('SELECT id, verified FROM users WHERE email = ?').get(cleanEmail);

    if (!user)
      return fail(res, 'No account found for this email address.');
    if (purpose === 'verify' && user.verified)
      return fail(res, 'This account is already verified. Please sign in.');

    const code = await createOTP(cleanEmail, purpose);
    await sendOTPEmail(cleanEmail, code, purpose);

    return ok(res, { message: 'New code sent! Check your inbox.' });
  } catch (err) {
    return handleError(res, err, 'resend-otp');
  }
});

// ─── POST /auth/login ─────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !validator.isEmail(email))
      return fail(res, 'Please enter a valid email address.');
    if (!password)
      return fail(res, 'Please enter your password.');

    const db         = getDb();
    const cleanEmail = email.trim().toLowerCase();
    const user       = db.prepare('SELECT * FROM users WHERE email = ?').get(cleanEmail);

    // Always run bcrypt even if user not found — prevents timing-based enumeration
    const hashToCheck = user?.password ?? '$2a$12$notavalidhashusedfortimingonly00';
    const match       = await bcrypt.compare(password, hashToCheck);

    if (!user || !match)
      return fail(res, 'Incorrect email or password.', 401);

    if (!user.verified) {
      // Auto-send a fresh OTP so they can complete verification
      try {
        const code = await createOTP(cleanEmail, 'verify');
        await sendOTPEmail(cleanEmail, code, 'verify');
      } catch (sendErr) {
        // Don't block the login response if resend fails — just warn
        console.error('[login] Could not send verification email:', sendErr.message);
      }
      return fail(res,
        "Your email isn't verified yet. We've sent a new code — please check your inbox.",
        403,
        'UNVERIFIED'
      );
    }

    return ok(res, {
      token: signToken(user.id),
      user:  { id: user.id, name: user.name, email: user.email, level: user.level },
    });
  } catch (err) {
    return handleError(res, err, 'login');
  }
});

// ─── POST /auth/forgot-password ───────────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !validator.isEmail(email))
      return fail(res, 'Please enter a valid email address.');

    const cleanEmail = email.trim().toLowerCase();
    const user = getDb()
      .prepare('SELECT id FROM users WHERE email = ? AND verified = 1')
      .get(cleanEmail);

    // Always return the same message regardless of whether the account exists
    if (user) {
      const code = await createOTP(cleanEmail, 'reset');
      await sendOTPEmail(cleanEmail, code, 'reset');
    }

    return ok(res, { message: 'If an account exists for this email, a reset code has been sent.' });
  } catch (err) {
    return handleError(res, err, 'forgot-password');
  }
});

// ─── POST /auth/reset-password ────────────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    if (!resetToken)
      return fail(res, 'Reset token is required.');
    if (!newPassword || newPassword.length < 8)
      return fail(res, 'New password must be at least 8 characters.');

    let payload;
    try {
      payload = jwt.verify(resetToken, process.env.JWT_SECRET);
    } catch {
      return fail(res, 'Reset link is invalid or has expired. Please start over.', 401);
    }

    if (payload.purpose !== 'reset')
      return fail(res, 'Invalid reset token.', 401);

    const hash = await bcrypt.hash(newPassword, 12);
    getDb().prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, payload.sub);

    return ok(res, { message: 'Password updated! Please sign in with your new password.' });
  } catch (err) {
    return handleError(res, err, 'reset-password');
  }
});

// ─── GET /auth/me ─────────────────────────────────────────────────────────────
router.get('/me', requireAuth, (req, res) => {
  const user = getDb()
    .prepare('SELECT id, name, email, level, verified, created_at FROM users WHERE id = ?')
    .get(req.user.sub);
  if (!user) return fail(res, 'Account not found.', 404);
  return ok(res, { user });
});

// ─── PATCH /auth/profile ──────────────────────────────────────────────────────
router.patch('/profile', requireAuth, (req, res) => {
  try {
    const { name, level } = req.body;
    const db = getDb();
    const userId = req.user.sub;

    if (!name || !name.trim()) {
      return fail(res, 'Name cannot be empty.', 400);
    }

    db.prepare('UPDATE users SET name = ?, level = ? WHERE id = ?')
      .run(name.trim(), level || 'grade_10', userId);

    const user = db.prepare('SELECT id, name, email, level, verified, created_at FROM users WHERE id = ?')
      .get(userId);

    return ok(res, { message: 'Profile updated.', user });
  } catch (err) {
    console.error('[profile update]', err);
    return fail(res, 'Could not update profile.', 500);
  }
});

// ─── POST /auth/change-password ────────────────────────────────────────────────
router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const db = getDb();
    const userId = req.user.sub;

    if (!currentPassword || !newPassword) {
      return fail(res, 'Current and new passwords are required.', 400);
    }

    if (newPassword.length < 8) {
      return fail(res, 'New password must be at least 8 characters.', 400);
    }

    const user = db.prepare('SELECT password FROM users WHERE id = ?').get(userId);
    if (!user) return fail(res, 'Account not found.', 404);

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) {
      return fail(res, 'Current password is incorrect.', 401);
    }

    const hash = await bcrypt.hash(newPassword, 10);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, userId);

    return ok(res, { message: 'Password changed successfully.' });
  } catch (err) {
    console.error('[change-password]', err);
    return fail(res, 'Could not change password.', 500);
  }
});

module.exports = { router, requireAuth };
