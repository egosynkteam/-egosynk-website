const crypto = require('crypto');
const { getStore } = require('./blob-store');
const { sendEmail, emailWrapper, buttonHtml } = require('./email');

// "Join the drop" sign-ups for products that aren't on sale yet (HYDRO, BOLD…), in the
// `waitlist` store. One record per product + email, so two sign-ups at the same moment can
// never overwrite each other (a single shared list blob could lose one of them).
//   key   `${product}__${email}`
//   value { product, email, phone, marketing, at, source, confirmedEmailAt }
const PRODUCTS = {
  'hydro-150': { name: 'HYDRO 150', page: '/hydro', line: 'our first pre-workout' },
  bold: { name: 'BOLD eau de parfum', page: '/bold', line: 'our eau de parfum' },
};
const SITE = 'https://egosynk.com';
const keyFor = (product, email) => `${product}__${encodeURIComponent(email)}`;

// Signed per product + address, so a "leave the list" link can't be forged for someone else.
function leaveToken(product, email) {
  const secret = process.env.UNSUB_SECRET || process.env.RAZORPAY_KEY_SECRET || 'egosynk';
  return crypto.createHmac('sha256', secret).update(`waitlist:${product}:${String(email).trim().toLowerCase()}`).digest('hex').slice(0, 32);
}
const leaveUrl = (product, email) =>
  `${SITE}/.netlify/functions/drop-waitlist?leave=1&p=${encodeURIComponent(product)}&e=${encodeURIComponent(email)}&t=${leaveToken(product, email)}`;

async function join(product, { email, phone, marketing, source }) {
  const store = getStore('waitlist');
  const key = keyFor(product, email);
  const existing = await store.get(key, { type: 'json' });
  if (existing) {
    // Signing up again can add a phone number or opt in to marketing, never remove either.
    const merged = { ...existing, phone: existing.phone || phone || '', marketing: existing.marketing || !!marketing };
    if (merged.phone !== existing.phone || merged.marketing !== existing.marketing) await store.setJSON(key, merged);
    return { added: false, record: merged };
  }
  const record = { product, email, phone: phone || '', marketing: !!marketing, at: new Date().toISOString(), source: source || '' };
  await store.setJSON(key, record);
  return { added: true, record };
}

async function remove(product, email) {
  const store = getStore('waitlist');
  const key = keyFor(product, email);
  if (!(await store.get(key, { type: 'json' }))) return false;
  await store.delete(key);
  return true;
}

async function count(product) {
  const { blobs } = await getStore('waitlist').list({ prefix: `${product}__` });
  return blobs.length;
}

async function list(product) {
  const rows = await getStore('waitlist').listValues({ prefix: `${product}__` });
  return rows.map((r) => r.value).sort((a, b) => String(a.at).localeCompare(String(b.at)));
}

// Sent once, on the first sign-up. Records the send so a re-sign-up never emails again.
// If email isn't configured (no RESEND_API_KEY) nothing is recorded, so nothing is lost.
async function sendConfirmation(record, position) {
  const p = PRODUCTS[record.product];
  if (!p || record.confirmedEmailAt) return { sent: false };
  const html = emailWrapper(`
    <h1 style="font-size:22px;margin:0 0 12px;">You're on the ${p.name} drop list.</h1>
    <p style="font-size:15px;line-height:1.6;margin:0 0 12px;">Thanks for signing up for ${p.line}. We'll email you the launch date and price before they go public, with early access to the first batch.</p>
    ${position ? `<p style="font-size:15px;line-height:1.6;margin:0 0 12px;">You're number <b>${Number(position).toLocaleString('en-IN')}</b> on the list.</p>` : ''}
    ${buttonHtml(SITE + p.page, `See ${p.name}`)}
    <p style="font-size:12px;line-height:1.6;color:#6b6b6b;margin:20px 0 0;">${record.marketing
      ? 'You also asked for other EGOSYNK launches and offers.'
      : 'We will only email you about this drop.'} Changed your mind? <a href="${leaveUrl(record.product, record.email)}" style="color:#C41E3A;">Leave the list</a>.</p>`);
  const result = await sendEmail({ to: record.email, subject: `You're on the ${p.name} drop list — EGOSYNK`, html });
  if (result && result.sent) {
    await getStore('waitlist').setJSON(keyFor(record.product, record.email), { ...record, confirmedEmailAt: new Date().toISOString() });
  }
  return result || { sent: false };
}

// CSV for the admin download. Fields that start with = + - @ are prefixed with ' so a
// spreadsheet never runs them as formulas.
function toCsv(rows) {
  const cell = (v) => {
    let s = String(v == null ? '' : v);
    if (/^[=+\-@]/.test(s)) s = `'${s}`;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = ['Signed up (IST)', 'Email', 'WhatsApp', 'Marketing opt-in', 'Confirmation emailed', 'Product'];
  const lines = rows.map((r) => [
    new Date(r.at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }), r.email, r.phone, r.marketing ? 'yes' : 'no',
    r.confirmedEmailAt ? 'yes' : 'no', r.product,
  ].map(cell).join(','));
  return [head.join(','), ...lines].join('\r\n') + '\r\n';
}

module.exports = { PRODUCTS, join, remove, count, list, keyFor, leaveToken, leaveUrl, sendConfirmation, toCsv };
