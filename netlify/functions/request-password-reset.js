const { getStore } = require('../lib/blob-store');
const { createToken } = require('../lib/tokens');
const { sendEmail, emailWrapper, buttonHtml, escapeHtml } = require('../lib/email');
const { logEvent } = require('../lib/audit');

const SITE_URL = process.env.SITE_URL || 'https://egosynk.com';

function normEmail(e) {
  return String(e || '').trim().toLowerCase();
}

// Always returns the same generic response whether or not the email has an account —
// otherwise this endpoint could be used to enumerate registered emails.
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const { email } = JSON.parse(event.body || '{}');
    const emailNorm = normEmail(email);
    if (!emailNorm) return { statusCode: 400, body: JSON.stringify({ error: 'Email is required' }) };

    const users = getStore('users');
    const user = await users.get(emailNorm, { type: 'json' });

    if (user) {
      const token = await createToken('password-resets', { email: emailNorm }, 60 * 60 * 1000); // 1 hour
      await sendEmail({
        to: emailNorm,
        subject: 'Reset your EGOSYNK password',
        html: emailWrapper(`
          <p style="font-size:14px;line-height:1.6;">Hey ${escapeHtml(user.name)},</p>
          <p style="font-size:14px;line-height:1.6;">Someone requested a password reset for this account. If that was you, set a new password below.</p>
          ${buttonHtml(`${SITE_URL}/reset-password.html?token=${token}`, 'Reset Password')}
          <p style="font-size:12px;color:#8B8D93;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email — your password won't change.</p>
        `),
      });
      await logEvent('password_reset_requested', emailNorm, {}, event);
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true, message: 'If that email has an account, a reset link has been sent.' }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Could not process request' }) };
  }
};
