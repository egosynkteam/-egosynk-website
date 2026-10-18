const { getStore } = require('../lib/blob-store');
const { isAdminAuthorized } = require('../lib/admin-auth');
const { STATE_CODES } = require('../lib/gst');

// GSTR-1 working files for one month of invoices, as CSV. GET ?month=YYYY-MM&type=…
//   register — every invoice line (for the books and the CA)
//   b2cs     — GSTR-1 Table 7: B2C supplies summed by place of supply + rate
//   hsn      — GSTR-1 Table 12: HSN-wise summary
//   docs     — GSTR-1 Table 13: invoice series issued
// Column layouts follow the GST offline tool's B2CS/HSN/DOCS sheets so the CA can paste
// them straight in. All sales are B2C via our own website (no e-commerce operator).
const TYPES = ['register', 'b2cs', 'hsn', 'docs'];
const STATE_NAMES = Object.fromEntries(Object.entries(STATE_CODES).map(([n, c]) => [c, n]));
const B2CL_LIMIT = 100000; // inter-state B2C invoices above this go to Table 5 (B2CL), not B2CS

const round2 = (n) => Math.round(n * 100) / 100;
const istMonth = (iso) => new Date(new Date(iso).getTime() + 330 * 60 * 1000).toISOString().slice(0, 7);
const istDate = (iso) => new Date(new Date(iso).getTime() + 330 * 60 * 1000).toISOString().slice(0, 10);
const pos = (inv) => `${inv.placeOfSupply.code}-${STATE_NAMES[inv.placeOfSupply.code] || inv.placeOfSupply.state}`;

function csv(rows) {
  return rows.map((r) => r.map((v) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\r\n');
}

// Groups rows by key, summing the numeric fields listed in `sums`.
function groupSum(items, keyFn, sums) {
  const map = new Map();
  for (const it of items) {
    const k = keyFn(it);
    const acc = map.get(k) || { ...it, ...Object.fromEntries(sums.map((f) => [f, 0])) };
    for (const f of sums) acc[f] = round2(acc[f] + it[f]);
    map.set(k, acc);
  }
  return [...map.values()];
}

exports.handler = async (event) => {
  if (!(await isAdminAuthorized(event))) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }
  const q = event.queryStringParameters || {};
  if (!/^\d{4}-\d{2}$/.test(q.month || '') || !TYPES.includes(q.type)) {
    return { statusCode: 400, body: JSON.stringify({ error: `Need month=YYYY-MM and type=${TYPES.join('|')}` }) };
  }

  try {
    const store = getStore('orders');
    const invoices = [];
    for (const b of (await store.list()).blobs) {
      const o = await store.get(b.key, { type: 'json' });
      if (o && o.invoice && istMonth(o.invoice.date) === q.month) invoices.push({ order: o, inv: o.invoice });
    }
    invoices.sort((a, b) => a.inv.number.localeCompare(b.inv.number));

    const lines = invoices.flatMap(({ order, inv }) => inv.lines.map((l) => ({
      ...l, inv, order, pos: pos(inv),
      b2cl: !inv.intraState && inv.totals.total > B2CL_LIMIT,
    })));

    let rows;
    if (q.type === 'register') {
      rows = [['Invoice No', 'Invoice Date', 'Order ID', 'Payment ID', 'Customer', 'Place Of Supply',
        'Item', 'Size', 'HSN', 'Qty', 'Rate %', 'Gross', 'Discount', 'Taxable Value', 'CGST', 'SGST', 'IGST', 'Line Total',
        'Fulfilment', 'Note']];
      for (const l of lines) {
        rows.push([l.inv.number, istDate(l.inv.date), l.order.orderId, l.order.paymentId, l.inv.buyer.name,
          l.pos, l.name, l.size, l.hsn, l.qty, l.gstRate, l.gross ?? l.total, l.discount || 0, l.taxable, l.cgst, l.sgst, l.igst, l.total,
          (l.order.fulfilment && l.order.fulfilment.status) || 'processing',
          [l.b2cl ? 'B2CL (report in Table 5)' : '',
            l.order.fulfilment && l.order.fulfilment.status === 'cancelled' ? 'Cancelled: needs credit note' : '']
            .filter(Boolean).join('; ')]);
      }
    } else if (q.type === 'b2cs') {
      rows = [['Type', 'Place Of Supply', 'Applicable % of Tax Rate', 'Rate', 'Taxable Value', 'Cess Amount',
        'E-Commerce GSTIN']];
      const groups = groupSum(lines.filter((l) => !l.b2cl), (l) => `${l.pos}|${l.gstRate}`, ['taxable']);
      for (const g of groups) rows.push(['OE', g.pos, '', g.gstRate, g.taxable, 0, '']);
    } else if (q.type === 'hsn') {
      rows = [['HSN', 'Description', 'UQC', 'Total Quantity', 'Total Value', 'Rate', 'Taxable Value',
        'Integrated Tax Amount', 'Central Tax Amount', 'State/UT Tax Amount', 'Cess Amount']];
      const groups = groupSum(lines, (l) => `${l.hsn}|${l.gstRate}`, ['qty', 'total', 'taxable', 'igst', 'cgst', 'sgst']);
      for (const g of groups) {
        rows.push([g.hsn, '', 'PCS-PIECES', g.qty, g.total, g.gstRate, g.taxable, g.igst, g.cgst, g.sgst, 0]);
      }
    } else {
      rows = [['Nature of Document', 'Sr. No. From', 'Sr. No. To', 'Total Number', 'Cancelled']];
      // "Cancelled" here means voided invoice numbers, which this system never produces; an
      // order cancelled after invoicing needs a credit note instead (flagged in the register).
      if (invoices.length) {
        rows.push(['Invoices for outward supply', invoices[0].inv.number, invoices[invoices.length - 1].inv.number,
          invoices.length, 0]);
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="egosynk-gstr1-${q.type}-${q.month}.csv"`,
      },
      body: '﻿' + csv(rows), // BOM so Excel reads ₹/— correctly
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Could not build GST report' }) };
  }
};
