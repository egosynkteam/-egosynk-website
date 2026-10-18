const crypto = require('crypto');
const { getStore } = require('./blob-store');
const { getSettings } = require('./settings');
const { sendEmail, emailWrapper, buttonHtml, escapeHtml } = require('./email');

// Abandoned-checkout reminders. A checkout that reached Razorpay leaves a `pending` order
// with the shopper's email; if it's still unpaid after `delayHours`, they get ONE email
// with a link that refills their bag (and the optional code from Settings).
// Skipped when: they've since paid for another order, they unsubscribed, the checkout is
// older than MAX_AGE_HOURS, or this order was already reminded. Only a successful send
// is recorded, so carts are retried once email (Resend) is configured.
const SITE = 'https://egosynk.com';
const MAX_AGE_HOURS = 48;

const emailKey = (e) => crypto.createHash('sha256').update(String(e || '').trim().toLowerCase()).digest('hex');

async function isOptedOut(email) {
  return !!(await getStore('email-optout').get(emailKey(email), { type: 'json' }));
}

function unsubToken(email) {
  // Signed so an unsubscribe link can't be forged for someone else's address.
  const secret = process.env.UNSUB_SECRET || process.env.RAZORPAY_KEY_SECRET || 'egosynk';
  return crypto.createHmac('sha256', secret).update(String(email).trim().toLowerCase()).digest('hex').slice(0, 32);
}

function reminderHtml(order, restoreUrl, unsubUrl, code) {
  const rows = order.items.map((i) => `<tr><td style="padding:6px 0;">${escapeHtml(i.name)}${i.size && !/^free size$/i.test(i.size) ? ' (' + escapeHtml(i.size) + ')' : ''} × ${i.qty}</td>
    <td style="padding:6px 0;text-align:right;">₹${(i.price * i.qty).toLocaleString('en-IN')}</td></tr>`).join('');
  return emailWrapper(`
    <p style="font-size:15px;line-height:1.6;margin:0 0 6px;"><strong>Your bag is still here, ${escapeHtml((order.shipping.name || '').split(' ')[0] || 'lifter')}.</strong></p>
    <p style="font-size:13px;line-height:1.6;color:#555;margin:0 0 12px;">You left a few things at checkout. We've kept them for you.</p>
    <table style="width:100%;font-size:13px;border-collapse:collapse;margin:8px 0 4px;">${rows}</table>
    ${code ? `<p style="font-size:13px;margin:14px 0 0;">Use code <strong style="letter-spacing:.06em;">${escapeHtml(code)}</strong> at checkout for a little extra.</p>` : ''}
    ${buttonHtml(restoreUrl, 'Return to your bag')}
    <p style="font-size:11px;color:#8B8D93;line-height:1.6;margin-top:18px;">Don't want these reminders? <a href="${unsubUrl}" style="color:#8B8D93;">Unsubscribe</a>.</p>`);
}

// Runs from the scheduled function. Returns a small report for the logs.
async function sendReminders(now = Date.now()) {
  const { abandonedCart: cfg } = await getSettings();
  if (!cfg || !cfg.enabled) return { skipped: 'disabled' };
  const store = getStore('orders');
  const orders = (await Promise.all((await store.list()).blobs.map((b) => store.get(b.key, { type: 'json' })))).filter(Boolean);
  const paidAfter = (email, t) => orders.some((o) => o.status === 'paid' &&
    String((o.shipping && o.shipping.email) || '').toLowerCase() === email && new Date(o.createdAt).getTime() >= t);

  const report = { checked: 0, sent: 0, skipped: 0, failed: 0 };
  // At most one reminder per person per MAX_AGE_HOURS, across runs — someone who
  // abandons twice in an evening gets one email, not two.
  const remindedEmails = new Set(orders
    .filter((o) => o.reminder && now - new Date(o.reminder.sentAt).getTime() < MAX_AGE_HOURS * 3600e3)
    .map((o) => String((o.shipping && o.shipping.email) || '').trim().toLowerCase()));
  for (const o of orders) {
    if (o.status !== 'pending' || o.reminder || !o.shipping || !o.shipping.email) continue;
    const age = (now - new Date(o.createdAt).getTime()) / 3600e3;
    if (age < cfg.delayHours || age > MAX_AGE_HOURS) continue;
    report.checked++;
    const email = String(o.shipping.email).trim().toLowerCase();
    // One email per person per run, even if they abandoned several times.
    if (remindedEmails.has(email) || paidAfter(email, new Date(o.createdAt).getTime()) || (await isOptedOut(email))) {
      report.skipped++;
      continue;
    }
    const token = o.restoreToken || crypto.randomBytes(16).toString('hex');
    const restoreUrl = `${SITE}/?restore=${token}`;
    const unsubUrl = `${SITE}/.netlify/functions/unsubscribe?e=${encodeURIComponent(email)}&t=${unsubToken(email)}`;
    const result = await sendEmail({ to: email, subject: 'You left something in your bag — EGOSYNK', html: reminderHtml(o, restoreUrl, unsubUrl, cfg.couponCode) });
    o.restoreToken = token;
    if (result.sent) {
      o.reminder = { sentAt: new Date(now).toISOString() };
      remindedEmails.add(email);
      report.sent++;
    } else {
      report.failed++;
    }
    await store.setJSON(o.orderId, o);
  }
  return report;
}

module.exports = { sendReminders, reminderHtml, unsubToken, emailKey, isOptedOut, MAX_AGE_HOURS };
