const crypto = require('crypto');
const { getStore } = require('../lib/blob-store');
const { allowRequest } = require('../lib/rate-limit');
const { logEvent } = require('../lib/audit');
const { getCategories } = require('../lib/settings');
const { TYPES, QUANTITIES, emailNewEnquiry } = require('../lib/enquiries');

// bulk.html form. POST { name, org?, type, email, phone, city?, categories: [id], quantity,
// branding?, message?, website (honeypot, must be empty) }.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const str = (v, max) => String(v == null ? '' : v).trim().slice(0, max);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  if (!(await allowRequest('bulk-enquiry', event, 5, 60 * 60 * 1000))) {
    return bad('Too many enquiries — try again later, or email support@egosynk.com', 429);
  }
  try {
    const b = JSON.parse(event.body || '{}');
    // Bots fill every field; pretend it worked so they don't retry.
    if (b.website) return { statusCode: 200, body: JSON.stringify({ ok: true }) };

    const name = str(b.name, 100);
    const email = str(b.email, 200).toLowerCase();
    const phone = str(b.phone, 10);
    if (!name) return bad('Enter your name');
    if (!EMAIL.test(email)) return bad('Enter a valid email');
    if (!/^[6-9]\d{9}$/.test(phone)) return bad('Enter a valid 10-digit mobile number');
    if (!TYPES[b.type]) return bad('Pick who the order is for');
    if (!QUANTITIES.includes(b.quantity)) return bad('Pick a rough quantity');

    const categories = await getCategories();
    const names = (Array.isArray(b.categories) ? b.categories : [])
      .map((id) => categories.find((c) => c.id === id && c.visible !== false))
      .filter(Boolean).map((c) => c.name);
    if (!names.length) return bad('Pick at least one product type');

    const now = new Date().toISOString();
    const key = `q/${now}-${crypto.randomBytes(3).toString('hex')}`;
    const q = {
      key, name, email, phone, type: b.type, quantity: b.quantity, categories: [...new Set(names)],
      org: str(b.org, 120) || null,
      city: str(b.city, 80) || null,
      branding: !!b.branding,
      message: str(b.message, 1000) || null,
      status: 'new',
      adminNote: null,
      createdAt: now,
    };
    await getStore('enquiries').setJSON(key, q);
    await logEvent('bulk_enquiry', email, { key, quantity: q.quantity }, event);
    try { await emailNewEnquiry(q); } catch (err) { console.error('Enquiry email failed:', err); }
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error(err);
    return bad('Could not send your enquiry', 500);
  }
};

const bad = (error, statusCode = 400) => ({ statusCode, body: JSON.stringify({ error }) });
