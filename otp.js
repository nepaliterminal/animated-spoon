'use strict';

const crypto     = require('crypto');
const bcrypt     = require('bcryptjs');
const nodemailer = require('nodemailer');
const { getDb }  = require('./db');

const OTP_DIGITS      = parseInt(process.env.OTP_DIGITS || '6', 10);
const OTP_EXPIRES_MIN = parseInt(process.env.OTP_EXPIRES_MINUTES || '10', 10);
const OTP_MAX_RESENDS = parseInt(process.env.OTP_MAX_RESENDS || '3', 10);

// ─── SMTP Transporter ────────────────────────────────────────────────────────
// One shared transporter with connection pooling.
// verifyTransporter() is called at startup so broken creds fail loud + early.

let _transporter = null;

function buildTransporter() {
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    pool:              true,
    maxConnections:    3,
    connectionTimeout: 10_000,
    greetingTimeout:   10_000,
    socketTimeout:     15_000,
  });
}

function getTransporter() {
  if (!_transporter) _transporter = buildTransporter();
  return _transporter;
}

/**
 * Call once at server startup. Opens a real SMTP connection + AUTH check.
 * Throws with a clear message if any SMTP env var is missing or credentials fail.
 */
async function verifyTransporter() {
  const required = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'];
  const missing  = required.filter(k => !process.env[k]);
  if (missing.length) {
    throw new Error(
      `SMTP configuration incomplete. Missing env vars: ${missing.join(', ')}\n` +
      `Copy .env.example to .env and fill in your SMTP credentials.`
    );
  }
  await getTransporter().verify();
  console.log(`✅  SMTP verified — ${process.env.SMTP_USER} @ ${process.env.SMTP_HOST}:${process.env.SMTP_PORT}`);
}

// ─── OTP Generation ──────────────────────────────────────────────────────────

function generateCode() {
  const num = crypto.randomInt(0, Math.pow(10, OTP_DIGITS));
  return num.toString().padStart(OTP_DIGITS, '0');
}

// ─── Database Operations ─────────────────────────────────────────────────────

async function createOTP(email, purpose) {
  const db = getDb();

  const existing = db.prepare(`
    SELECT id, resend_count FROM otps
    WHERE  email = ? AND purpose = ? AND used = 0 AND expires_at > datetime('now')
    ORDER  BY id DESC LIMIT 1
  `).get(email, purpose);

  if (existing && existing.resend_count >= OTP_MAX_RESENDS) {
    const err = new Error(
      `Maximum resend limit reached (${OTP_MAX_RESENDS}x). ` +
      `Wait ${OTP_EXPIRES_MIN} minutes for the current code to expire then try again.`
    );
    err.code = 'OTP_LIMIT';
    throw err;
  }

  // Void all previous OTPs for this email+purpose
  db.prepare(`UPDATE otps SET used = 1 WHERE email = ? AND purpose = ? AND used = 0`)
    .run(email, purpose);

  const code      = generateCode();
  const hash      = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + OTP_EXPIRES_MIN * 60 * 1000)
    .toISOString().replace('T', ' ').slice(0, 19);

  db.prepare(`
    INSERT INTO otps (email, code_hash, purpose, expires_at, resend_count)
    VALUES (?, ?, ?, ?, ?)
  `).run(email, hash, purpose, expiresAt, existing ? existing.resend_count + 1 : 0);

  return code;
}

async function verifyOTP(email, code, purpose) {
  const db = getDb();

  const row = db.prepare(`
    SELECT id, code_hash, expires_at FROM otps
    WHERE  email = ? AND purpose = ? AND used = 0
    ORDER  BY id DESC LIMIT 1
  `).get(email, purpose);

  if (!row) {
    const err = new Error('No active verification code found. Please request a new one.');
    err.code = 'OTP_NOT_FOUND';
    throw err;
  }

  if (Date.now() > new Date(row.expires_at.replace(' ', 'T') + 'Z').getTime()) {
    const err = new Error('Your verification code has expired. Please request a new one.');
    err.code = 'OTP_EXPIRED';
    throw err;
  }

  const match = await bcrypt.compare(code, row.code_hash);
  if (!match) {
    const err = new Error('Incorrect code. Please check and try again.');
    err.code = 'OTP_WRONG';
    throw err;
  }

  db.prepare('UPDATE otps SET used = 1 WHERE id = ?').run(row.id);
  return true;
}

// ─── Email Sending ───────────────────────────────────────────────────────────

async function sendOTPEmail(email, code, purpose) {
  const isReset   = purpose === 'reset';
  const subject   = isReset ? 'KrynoLux — Reset Your Password' : 'KrynoLux — Verify Your Email';
  const headline  = isReset ? 'Password Reset Request' : 'Confirm your email address';
  const bodyText  = isReset
    ? "We received a request to reset your KrynoLux password. Use the code below. If this wasn't you, ignore this email — your password won't change."
    : "Thanks for joining KrynoLux! Enter the code below to verify your email and start studying.";
  const codeLabel = isReset ? 'RESET CODE' : 'VERIFICATION CODE';

  // Format code as "123 456" for readability in the email
  const displayCode = code.slice(0, 3) + '&nbsp;&nbsp;' + code.slice(3);

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#F7F6F2;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.10);">

  <!-- Header -->
  <tr>
    <td style="background:linear-gradient(135deg,#3B5BDB 0%,#7C3AED 100%);padding:36px 40px;text-align:center;">
      <div style="display:inline-block;background:rgba(255,255,255,.15);border-radius:14px;padding:8px 20px;margin-bottom:12px;">
        <span style="font-size:26px;font-weight:800;color:#fff;letter-spacing:-.5px;">KrynoLux</span>
      </div>
      <p style="color:rgba(255,255,255,.7);font-size:12px;margin:0;letter-spacing:.1em;text-transform:uppercase;">Study Smarter. Learn Better.</p>
    </td>
  </tr>

  <!-- Body -->
  <tr>
    <td style="padding:40px 40px 32px;">
      <p style="font-size:18px;font-weight:600;color:#1A1916;margin:0 0 10px;line-height:1.3;">${headline}</p>
      <p style="font-size:14px;color:#6B6860;line-height:1.65;margin:0 0 32px;">${bodyText}</p>

      <!-- OTP Box -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="background:#EEF2FF;border-radius:16px;padding:28px 24px;text-align:center;">
            <p style="font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#3B5BDB;margin:0 0 14px;">${codeLabel}</p>
            <p style="font-family:'Courier New',Courier,monospace;font-size:46px;font-weight:700;letter-spacing:8px;color:#1A1916;margin:0;line-height:1;">${displayCode}</p>
            <p style="font-size:12px;color:#6B6860;margin:14px 0 0;">Expires in <strong>${OTP_EXPIRES_MIN} minutes</strong></p>
          </td>
        </tr>
      </table>

      <p style="font-size:13px;color:#A09E98;line-height:1.6;margin:24px 0 0;">
        This code is <strong>single-use</strong> and expires in ${OTP_EXPIRES_MIN} minutes.<br>
        <strong>Never share this code</strong> — KrynoLux staff will never ask for it.
      </p>
    </td>
  </tr>

  <!-- Footer -->
  <tr>
    <td style="background:#F7F6F2;border-top:1px solid #E5E2D8;padding:18px 40px;">
      <p style="font-size:12px;color:#A09E98;margin:0;text-align:center;">
        &copy; ${new Date().getFullYear()} KrynoLux &nbsp;&middot;&nbsp;
        <a href="https://krynolux.work" style="color:#3B5BDB;text-decoration:none;">krynolux.work</a>
      </p>
    </td>
  </tr>

</table>
<p style="font-size:11px;color:#A09E98;text-align:center;margin:16px 0 0;">
  You're receiving this because someone registered at KrynoLux with this address.<br>If this wasn't you, no action is needed.
</p>
</td></tr>
</table>
</body>
</html>`;

  const text = [
    `KrynoLux — ${subject}`,
    '',
    headline,
    '',
    bodyText,
    '',
    `${codeLabel}: ${code}`,
    '',
    `Expires in ${OTP_EXPIRES_MIN} minutes.`,
    `Single-use only. Never share this code.`,
    '',
    `KrynoLux — https://krynolux.work`,
  ].join('\n');

  let info;
  try {
    info = await getTransporter().sendMail({
      from:    process.env.EMAIL_FROM || `KrynoLux <noreply@krynolux.work>`,
      to:      email,
      subject,
      html,
      text,
    });
  } catch (smtpErr) {
    // Full SMTP error logged server-side; sanitised message sent to caller
    console.error(`[otp] SMTP send FAILED → ${email} | ${smtpErr.message}`);
    const err = new Error('Failed to send verification email. Please try again in a moment.');
    err.code  = 'EMAIL_SEND_FAILED';
    throw err;
  }

  console.log(`[otp] ✉  ${purpose} OTP → ${email} | msgId: ${info.messageId}`);
  return info;
}

/**
 * Quick SMTP smoke-test. Hit GET /auth/test-email?to=you@example.com
 * (remove this endpoint before going public if you don't want it exposed)
 */
async function sendTestEmail(to) {
  const info = await getTransporter().sendMail({
    from:    process.env.EMAIL_FROM || `KrynoLux <noreply@krynolux.work>`,
    to,
    subject: 'KrynoLux — SMTP Test ✅',
    text:    `SMTP is working.\n\nSent: ${new Date().toISOString()}\nFrom: ${process.env.SMTP_USER} via ${process.env.SMTP_HOST}`,
    html:    `<p>✅ <strong>SMTP is working correctly.</strong><br>Sent: ${new Date().toISOString()}<br>From: ${process.env.SMTP_USER} via ${process.env.SMTP_HOST}</p>`,
  });
  console.log(`[otp] Test email → ${to} | msgId: ${info.messageId}`);
  return info;
}

/**
 * Send a weekly activity report email to the user
 */
async function sendWeeklyReport(user) {
  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  const reportHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <h2 style="color: #3B5BDB;">📊 KrynoLux Weekly Report</h2>
      <p>Hi <strong>${user.name}</strong>,</p>
      <p>Here's your learning activity for the week of <strong>${weekAgo.toLocaleDateString()} - ${today.toLocaleDateString()}</strong>:</p>

      <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #3B5BDB;">This Week's Stats</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr style="border-bottom: 1px solid #ddd;">
            <td style="padding: 10px 0;"><strong>Total Study Time</strong></td>
            <td style="text-align: right; padding: 10px 0;">–</td>
          </tr>
          <tr style="border-bottom: 1px solid #ddd;">
            <td style="padding: 10px 0;"><strong>Tasks Completed</strong></td>
            <td style="text-align: right; padding: 10px 0;">–</td>
          </tr>
          <tr>
            <td style="padding: 10px 0;"><strong>Quiz Performance</strong></td>
            <td style="text-align: right; padding: 10px 0;">–</td>
          </tr>
        </table>
      </div>

      <p style="color: #666; font-size: 14px;">Keep up the great work! Log in to KrynoLux to see detailed insights.</p>
      <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
      <p style="color: #999; font-size: 12px;">This email was sent to ${user.email} by KrynoLux. <a href="#" style="color: #3B5BDB; text-decoration: none;">Manage preferences</a></p>
    </div>
  `;

  const info = await getTransporter().sendMail({
    from:    process.env.EMAIL_FROM || `KrynoLux <noreply@krynolux.work>`,
    to:      user.email,
    subject: '📊 Your KrynoLux Weekly Report',
    text:    `Weekly Report for ${user.name}\n\nWeek of ${weekAgo.toLocaleDateString()} - ${today.toLocaleDateString()}\n\nView your full report in the app.`,
    html:    reportHtml,
  });
  console.log(`[otp] Weekly report → ${user.email} | msgId: ${info.messageId}`);
  return info;
}


module.exports = { verifyTransporter, createOTP, verifyOTP, sendOTPEmail, sendTestEmail, sendWeeklyReport };
