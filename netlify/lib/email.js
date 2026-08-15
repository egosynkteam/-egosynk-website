// Sends transactional email via Resend's HTTP API directly (fetch, no SDK dependency —
// Netlify's Node 18+ function runtime has fetch built in). Requires RESEND_API_KEY.
// Never throws: a broken/missing email config must not block signup, checkout, or
// password reset from completing — those are all more important than the email itself.
const FROM = 'EGOSYNK <support@egosynk.com>';

async function sendEmail({ to, subject, html }) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set — skipping email:', subject, 'to', to);
    return { sent: false, reason: 'not_configured' };
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM, to, subject, html }),
    });
    if (!res.ok) {
      console.error('Resend send failed:', res.status, await res.text());
      return { sent: false, reason: 'api_error' };
    }
    return { sent: true };
  } catch (err) {
    console.error('Email send crashed:', err);
    return { sent: false, reason: 'exception' };
  }
}

// Shared light-theme wrapper — dark brand backgrounds render unreliably across email
// clients, so transactional emails use a plain light template with the brand accent only.
function emailWrapper(bodyHtml) {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:28px 24px;color:#17181B;">
    <div style="font-weight:900;letter-spacing:0.02em;text-transform:uppercase;font-size:20px;margin-bottom:24px;">
      EGO<span style="color:#C41E3A;">SYNK</span>
    </div>
    ${bodyHtml}
    <div style="margin-top:32px;padding-top:16px;border-top:1px solid #E5E5E5;font-size:11px;color:#8B8D93;line-height:1.6;">
      EGOSYNK · Compression Engineered for the Grind · Mumbai<br>
      Questions? <a href="mailto:support@egosynk.com" style="color:#C41E3A;">support@egosynk.com</a>
    </div>
  </div>`;
}

function buttonHtml(href, label) {
  return `<a href="${href}" style="display:inline-block;background:#C41E3A;color:#EDEAE3;text-decoration:none;padding:12px 24px;border-radius:2px;font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:0.05em;margin:16px 0;">${label}</a>`;
}

// Escapes user-supplied text (names, addresses) before it's interpolated into an email's
// HTML body — same defense-in-depth reasoning as escaping on the confirmation/account pages.
function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = { sendEmail, emailWrapper, buttonHtml, escapeHtml };
