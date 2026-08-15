const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { getStore } = require('@netlify/blobs');
const { sessionCookie, SESSION_MAX_AGE_SECONDS } = require('../lib/cookies');
const { logEvent } = require('../lib/audit');
const { createToken } = require('../lib/tokens');
const { sendEmail, emailWrapper, buttonHtml, escapeHtml: escapeForEmail } = require('../lib/email');

const SITE_URL = process.env.SITE_URL || 'https://egosynk.com';

function normEmail(e) {
  return String(e || '').trim().toLowerCase();
}

// New-user path: creates the account record in the `users` store and logs the caller
// straight in (matches the guest-friendly, low-friction flow used at checkout too).
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { name, email, phone, password } = JSON.parse(event.body || '{}');
    const emailNorm = normEmail(email);

    if (!name || !emailNorm || !password) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Name, email and password are required' }) };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Enter a valid email address' }) };
    }
    if (String(password).length < 8) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Password must be at least 8 characters' }) };
    }

    const users = getStore('users');
    const existing = await users.get(emailNorm, { type: 'json' });
    if (existing) {
      return { statusCode: 409, body: JSON.stringify({ error: 'An account with this email already exists — try logging in.' }) };
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = `usr_${crypto.randomBytes(8).toString('hex')}`;
    const now = new Date().toISOString();

    const user = {
      id: userId,
      name: String(name).slice(0, 120),
      email: emailNorm,
      phone: phone ? String(phone).slice(0, 20) : null,
      passwordHash,
      emailVerified: false,
      addresses: [],
      createdAt: now,
      updatedAt: now,
    };
    await users.setJSON(emailNorm, user);

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000).toISOString();
    const sessions = getStore('sessions');
    await sessions.setJSON(token, { userKey: emailNorm, email: emailNorm, createdAt: now, expiresAt });

    await logEvent('signup', emailNorm, { userId }, event);

    // Verification email is fire-and-forget — a missing/broken email config must never
    // block account creation. account.html shows an unverified banner + resend option.
    const verifyToken = await createToken('email-verifications', { email: emailNorm }, 24 * 60 * 60 * 1000);
    await sendEmail({
      to: emailNorm,
      subject: 'Verify your EGOSYNK account',
      html: emailWrapper(`
        <p style="font-size:14px;line-height:1.6;">Hey ${escapeForEmail(user.name)},</p>
        <p style="font-size:14px;line-height:1.6;">Welcome to EGOSYNK. Verify your email to finish setting up your account.</p>
        ${buttonHtml(`${SITE_URL}/verify-email.html?token=${verifyToken}`, 'Verify Email')}
        <p style="font-size:12px;color:#8B8D93;">This link expires in 24 hours. If you didn't create this account, you can ignore this email.</p>
      `),
    });

    return {
      statusCode: 200,
      headers: { 'Set-Cookie': sessionCookie(token) },
      body: JSON.stringify({ id: userId, name: user.name, email: emailNorm, phone: user.phone }),
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Signup failed' }) };
  }
};
