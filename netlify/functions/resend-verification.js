const { getSessionUser } = require('../lib/session');
const { createToken } = require('../lib/tokens');
const { sendEmail, emailWrapper, buttonHtml, escapeHtml } = require('../lib/email');

const SITE_URL = process.env.SITE_URL || 'https://egosynk.com';

// Session-protected — only a logged-in user can trigger a resend for their own account.
// account.html calls this when it sees emailVerified:false on the profile.
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const session = await getSessionUser(event);
    if (!session) return { statusCode: 401, body: JSON.stringify({ error: 'Not logged in' }) };
    if (session.user.emailVerified) {
      return { statusCode: 200, body: JSON.stringify({ ok: true, alreadyVerified: true }) };
    }

    const verifyToken = await createToken('email-verifications', { email: session.user.email }, 24 * 60 * 60 * 1000);
    await sendEmail({
      to: session.user.email,
      subject: 'Verify your EGOSYNK account',
      html: emailWrapper(`
        <p style="font-size:14px;line-height:1.6;">Hey ${escapeHtml(session.user.name)},</p>
        <p style="font-size:14px;line-height:1.6;">Here's a fresh link to verify your email.</p>
        ${buttonHtml(`${SITE_URL}/verify-email.html?token=${verifyToken}`, 'Verify Email')}
        <p style="font-size:12px;color:#8B8D93;">This link expires in 24 hours.</p>
      `),
    });

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Could not resend verification email' }) };
  }
};
