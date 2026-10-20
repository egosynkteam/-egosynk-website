const { getStore } = require('./blob-store');
const { sendEmail, emailWrapper, buttonHtml, escapeHtml } = require('./email');
const { isOptedOut, unsubToken } = require('./abandoned');
const { deliveredAt } = require('./exchanges');
const { getPublicCatalog } = require('./catalog');

// One "how's the fit?" email per delivered order, DELAY_DAYS after delivery, asking for a
// review of each item (the link opens that product's review form with the order filled in).
// Skipped when they unsubscribed, already reviewed everything in the order, or the
// delivery is older than MAX_DAYS. Only a successful send is recorded, so orders are
// retried once email (Resend) is configured.
const SITE = 'https://egosynk.com';
const DELAY_DAYS = 4;
const MAX_DAYS = 30;

function requestHtml(order, lines, unsubUrl) {
  return emailWrapper(`
    <p style="font-size:14px;line-height:1.6;">Hi ${escapeHtml(String(order.shipping.name).split(' ')[0])}, how's the fit?</p>
    <p style="font-size:14px;line-height:1.6;">A quick review helps other lifters pick the right size. It takes a minute, and we read every one.</p>
    ${lines.map((l) => `<p style="font-size:13px;margin:16px 0 6px;">${escapeHtml(l.name)}${l.size && !/^free size$/i.test(l.size) ? ' (' + escapeHtml(l.size) + ')' : ''}</p>
      ${buttonHtml(l.url, 'Review it')}`).join('')}
    <p style="font-size:12px;color:#8B8D93;line-height:1.6;margin-top:18px;">Something not right? Reply to this email, or start an exchange from My orders.</p>
    <p style="font-size:11px;color:#8B8D93;line-height:1.6;">Don't want these emails? <a href="${unsubUrl}" style="color:#8B8D93;">Unsubscribe</a>.</p>`);
}

async function sendReviewRequests(now = Date.now()) {
  const orders = getStore('orders');
  const reviews = getStore('reviews');
  const report = { checked: 0, sent: 0, skipped: 0, failed: 0 };
  let products = null;
  for (const { value: o } of await orders.listValues()) {
    if (o.status !== 'paid' || o.reviewRequest || !o.shipping || !o.shipping.email) continue;
    const at = deliveredAt(o);
    if (!at || !o.fulfilment || o.fulfilment.status !== 'delivered') continue;
    const days = (now - new Date(at).getTime()) / 86400e3;
    if (days < DELAY_DAYS || days > MAX_DAYS) continue;
    report.checked++;

    if (!products) products = new Map((await getPublicCatalog()).products.map((p) => [p.id, p]));
    const lines = [];
    for (const i of o.items) {
      const p = products.get(i.id);
      if (!p || (await reviews.get(`r/${i.id}/${o.orderId}`))) continue; // gone from the store, or already reviewed
      if (lines.some((l) => l.id === i.id)) continue;
      lines.push({ id: i.id, name: i.name, size: i.size, url: `${SITE}/p/${p.slug}?review=${encodeURIComponent(o.orderId)}#reviews` });
    }
    const email = o.shipping.email;
    if (!lines.length || (await isOptedOut(email))) {
      o.reviewRequest = { skipped: true, at: new Date(now).toISOString() };
      await orders.setJSON(o.orderId, o);
      report.skipped++;
      continue;
    }
    const unsubUrl = `${SITE}/.netlify/functions/unsubscribe?e=${encodeURIComponent(email)}&t=${unsubToken(email)}`;
    const result = await sendEmail({ to: email, subject: "How's the fit? — EGOSYNK", html: requestHtml(o, lines, unsubUrl) });
    if (result && result.sent) {
      o.reviewRequest = { sentAt: new Date(now).toISOString(), items: lines.map((l) => l.id) };
      await orders.setJSON(o.orderId, o);
      report.sent++;
    } else {
      report.failed++;
    }
  }
  return report;
}

module.exports = { sendReviewRequests, DELAY_DAYS, MAX_DAYS };
