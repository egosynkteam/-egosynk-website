const { getStore } = require('./blob-store');
const { sendEmail, emailWrapper, buttonHtml, escapeHtml } = require('./email');
const { productSlug } = require('./catalog');

// "Notify me when back in stock" sign-ups, one blob per product + size in the
// `stock-alerts` store: { emails: [{ email, at }] }. A whole-product alert (the product is
// switched off as sold out) uses the size key "_any".
const MAX_PER_KEY = 500;
const keyFor = (productId, size) => `${productId}__${size ? encodeURIComponent(size) : '_any'}`;

async function addAlert(productId, size, email) {
  const store = getStore('stock-alerts');
  const key = keyFor(productId, size);
  const rec = (await store.get(key, { type: 'json' })) || { emails: [] };
  if (rec.emails.some((e) => e.email === email)) return { added: false };
  if (rec.emails.length >= MAX_PER_KEY) return { added: false };
  rec.emails.push({ email, at: new Date().toISOString() });
  await store.setJSON(key, rec);
  return { added: true };
}

const inStock = (p, size) => {
  const m = p && p.stockBySize;
  return !m || !Number.isFinite(m[size]) || m[size] > 0;
};

// Called after admin saves a product. Emails everyone waiting on a size that was sold out
// before this save and is buyable now. Sends that fail (or are skipped because email
// isn't configured) stay on the list, so the next restock save tries again.
async function notifyRestock(before, after) {
  if (!before || !after || after.available === false || after.visible === false) return { sent: 0 };
  const wasOff = before.available === false;
  const sizes = (after.sizes || []).filter((s) => inStock(after, s) && (wasOff || !inStock(before, s)));
  const keys = sizes.map((s) => keyFor(after.id, s));
  if (wasOff) keys.push(keyFor(after.id, null));

  const store = getStore('stock-alerts');
  const url = `https://egosynk.com/p/${encodeURIComponent(productSlug(after))}`;
  let sent = 0;
  for (const key of keys) {
    const rec = await store.get(key, { type: 'json' });
    if (!rec || !rec.emails.length) continue;
    const size = decodeURIComponent(key.split('__')[1]);
    const label = size === '_any' ? '' : ` in ${escapeHtml(size)}`;
    const remaining = [];
    for (const e of rec.emails) {
      const result = await sendEmail({
        to: e.email,
        subject: `Back in stock: ${after.name}`,
        html: emailWrapper(`
          <p style="font-size:14px;line-height:1.6;"><strong>${escapeHtml(after.name)}</strong> is back${label}.</p>
          <p style="font-size:14px;line-height:1.6;">You asked us to tell you. Stock is limited, so grab it before it goes again.</p>
          ${buttonHtml(url, 'Shop now')}
          <p style="font-size:11px;color:#8B8D93;">You're getting this once because you signed up on the product page. No further emails about this item.</p>`),
      });
      if (result.sent) sent++;
      else remaining.push(e);
    }
    if (remaining.length) await store.setJSON(key, { emails: remaining });
    else await store.delete(key);
  }
  return { sent };
}

module.exports = { addAlert, notifyRestock };
