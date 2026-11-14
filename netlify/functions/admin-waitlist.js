const { requireAdmin } = require('../lib/admin-auth');
const { logEvent } = require('../lib/audit');
const { PRODUCTS, list, remove, toCsv } = require('../lib/waitlist');

// Drop lists for admin.html → Drop list.
//   GET                          -> { products: [{ id, name, count, marketing, phones, last7, rows }] }
//   GET ?format=csv&product=<id> -> CSV download of one list
//   POST { action: 'delete', product, email }
exports.handler = async (event) => {
  const auth = await requireAdmin(event, 'waitlist');
  if (auth.response) return auth.response;
  try {
    const q = event.queryStringParameters || {};
    if (event.httpMethod === 'GET' && q.format === 'csv') {
      if (!PRODUCTS[q.product]) return bad('Unknown product', 404);
      await logEvent('waitlist_export', auth.admin.email, { product: q.product }, event);
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="egosynk-${q.product}-drop-list.csv"`,
          'Cache-Control': 'no-store',
        },
        // BOM so Excel opens the ₹ and Indian names correctly.
        body: '﻿' + toCsv(await list(q.product)),
      };
    }
    if (event.httpMethod === 'GET') {
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const products = await Promise.all(Object.entries(PRODUCTS).map(async ([id, p]) => {
        const rows = await list(id);
        return {
          id, name: p.name, count: rows.length,
          marketing: rows.filter((r) => r.marketing).length,
          phones: rows.filter((r) => r.phone).length,
          last7: rows.filter((r) => Date.parse(r.at) >= weekAgo).length,
          rows: rows.slice().reverse(),
        };
      }));
      return { statusCode: 200, headers: { 'Cache-Control': 'no-store' }, body: JSON.stringify({ products }) };
    }
    if (event.httpMethod !== 'POST') return bad('Method Not Allowed', 405);

    const b = JSON.parse(event.body || '{}');
    if (b.action !== 'delete') return bad('Unknown action');
    if (!PRODUCTS[b.product]) return bad('Unknown product', 404);
    const email = String(b.email || '').trim().toLowerCase();
    if (!(await remove(b.product, email))) return bad('Not on the list', 404);
    await logEvent('waitlist_delete', auth.admin.email, { product: b.product, email }, event);
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error(err);
    return bad('Drop list request failed', 500);
  }
};

const bad = (error, statusCode = 400) => ({ statusCode, body: JSON.stringify({ error }) });
