// GST tax-invoice logic: HSN/rate lookup, CGST+SGST vs IGST split, and sequential
// invoice numbering. Catalog prices are GST-INCLUSIVE (what the customer pays), so tax
// is backed out of each line rather than added on top.
//
// HSN codes and rates below are the founder's best mapping under the Sept-2025 GST
// rate structure — have the CA confirm them before go-live. A product in the catalog
// store can override its category default by carrying its own `hsn` / `gstRate` fields.
const { getStore } = require('./blob-store');

const SUPPLIER = {
  tradeName: 'EGOSYNK',
  gstin: '27AKHPY6964E1ZI',
  // Shortened from the full registered PPOB at the founder's request; confirm with the CA.
  address: 'Dadar (W), Mumbai, Maharashtra 400028',
  state: 'Maharashtra',
  stateCode: '27',
  email: 'support@egosynk.com',
};

// Textile goods (chapters 61/62/63): 5% when the sale value per piece is up to ₹2,500,
// 18% above it. `textile: true` applies that slab; otherwise `rate` is flat.
const CATEGORY_TAX = {
  sleeves: { hsn: '6117', textile: true },
  innerwear: { hsn: '6107', textile: true },
  socks: { hsn: '6115', textile: true },
  compression: { hsn: '6109', textile: true },
  bottoms: { hsn: '6103', textile: true },
  accessories: { hsn: '9506', rate: 5 },
  fragrance: { hsn: '3303', rate: 18 },
};
const TEXTILE_THRESHOLD = 2500;

// GST state codes, keyed by the exact names offered in the checkout state dropdown.
const STATE_CODES = {
  'Andaman and Nicobar Islands': '35', 'Andhra Pradesh': '37', 'Arunachal Pradesh': '12',
  'Assam': '18', 'Bihar': '10', 'Chandigarh': '04', 'Chhattisgarh': '22',
  'Dadra and Nagar Haveli and Daman and Diu': '26', 'Delhi': '07', 'Goa': '30',
  'Gujarat': '24', 'Haryana': '06', 'Himachal Pradesh': '02', 'Jammu and Kashmir': '01',
  'Jharkhand': '20', 'Karnataka': '29', 'Kerala': '32', 'Ladakh': '38',
  'Lakshadweep': '31', 'Madhya Pradesh': '23', 'Maharashtra': '27', 'Manipur': '14',
  'Meghalaya': '17', 'Mizoram': '15', 'Nagaland': '13', 'Odisha': '21',
  'Puducherry': '34', 'Punjab': '03', 'Rajasthan': '08', 'Sikkim': '11',
  'Tamil Nadu': '33', 'Telangana': '36', 'Tripura': '16', 'Uttar Pradesh': '09',
  'Uttarakhand': '05', 'West Bengal': '19',
};

// Older orders stored free-text states — match them case-insensitively.
function stateCodeFor(state) {
  const s = String(state || '').trim().toLowerCase();
  const name = Object.keys(STATE_CODES).find((n) => n.toLowerCase() === s);
  return name ? STATE_CODES[name] : null;
}

// Snapshot of the tax treatment for one product, taken when the order is created so a
// later catalog edit can't change what an already-placed order is taxed at.
function taxInfoFor(product, unitPrice) {
  const def = CATEGORY_TAX[product.cat] || {};
  const hsn = product.hsn || def.hsn || null;
  let rate = Number.isFinite(product.gstRate) ? product.gstRate : def.rate;
  if (!Number.isFinite(rate) && def.textile) {
    rate = unitPrice / 1.05 <= TEXTILE_THRESHOLD ? 5 : 18;
  }
  if (!Number.isFinite(rate)) rate = 18; // unknown category: highest standard slab, flag in review
  return { hsn, gstRate: rate };
}

const round2 = (n) => Math.round(n * 100) / 100;

// Indian financial year label for a date, e.g. 2026-10-18 -> "26-27".
// Computed in IST — functions run in UTC, which would misfile orders paid just after
// midnight on 1 April.
function fyLabel(date) {
  const ist = new Date(date.getTime() + 330 * 60 * 1000);
  const y = ist.getUTCFullYear() % 100;
  const startYear = ((ist.getUTCMonth() >= 3 ? y : y - 1) + 100) % 100;
  return `${String(startYear).padStart(2, '0')}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

// Builds the line-level tax breakdown. Intra-state (buyer in Maharashtra) → CGST + SGST,
// half each; anything else → IGST.
function buildInvoiceBody(order, items) {
  const posCode = stateCodeFor(order.shipping.state) || order.shipping.stateCode || null;
  const intraState = posCode === SUPPLIER.stateCode;
  const lines = items.map((i) => {
    const total = i.price * i.qty;
    // CGST and SGST are each computed at half the rate so the two always match to the
    // paisa; any rounding remainder lands in the taxable value instead.
    const half = round2((total * i.gstRate) / 2 / (100 + i.gstRate));
    const igst = intraState ? 0 : round2((total * i.gstRate) / (100 + i.gstRate));
    const cgst = intraState ? half : 0;
    const sgst = intraState ? half : 0;
    const taxable = round2(total - cgst - sgst - igst);
    return {
      name: i.name, size: i.size, hsn: i.hsn, qty: i.qty, unitPrice: i.price,
      gstRate: i.gstRate, taxable, cgst, sgst, igst, total,
    };
  });
  const sum = (k) => round2(lines.reduce((a, l) => a + l[k], 0));
  return {
    supplier: SUPPLIER,
    buyer: order.shipping,
    placeOfSupply: { state: order.shipping.state, code: posCode },
    intraState,
    reverseCharge: false,
    lines,
    totals: {
      taxable: sum('taxable'), cgst: sum('cgst'), sgst: sum('sgst'), igst: sum('igst'),
      total: sum('total'),
    },
  };
}

// Orders created before tax snapshots existed lack hsn/gstRate — fill them from the
// live catalog so those can still be invoiced.
async function withTaxInfo(items) {
  const catalog = getStore('catalog');
  return Promise.all(items.map(async (i) => {
    if (i.hsn && Number.isFinite(i.gstRate)) return i;
    const product = (await catalog.get(String(i.id), { type: 'json' })) || {};
    return { ...i, ...taxInfoFor({ ...product, cat: i.cat || product.cat }, i.price) };
  }));
}

// Claims the next number in this financial year's series, e.g. EGS/26-27/00001 (15 chars,
// within GST's 16-char limit). This Blobs version has no compare-and-swap, so each number
// is claimed by writing a marker key and reading it back; with a single store and low
// order volume a collision is very unlikely, and the read-back catches the rare one.
async function allocateInvoiceNumber(orderId, date) {
  const store = getStore('invoices');
  const fy = fyLabel(date);
  const counterKey = `counter/${fy}`;
  let next = ((await store.get(counterKey, { type: 'json' })) || { last: 0 }).last + 1;
  for (let attempt = 0; attempt < 20; attempt++, next++) {
    const claimKey = `claim/${fy}/${next}`;
    const existing = await store.get(claimKey, { type: 'json' });
    if (existing && existing.orderId !== orderId) continue;
    await store.setJSON(claimKey, { orderId });
    const check = await store.get(claimKey, { type: 'json' });
    if (check && check.orderId === orderId) {
      await store.setJSON(counterKey, { last: next });
      return `EGS/${fy}/${String(next).padStart(5, '0')}`;
    }
  }
  throw new Error('Could not allocate invoice number');
}

// Idempotent: returns the existing invoice if the order already has one. Mutates and
// saves the order. Only paid orders get invoices.
async function ensureInvoice(order) {
  if (order.invoice) return order.invoice;
  if (order.status !== 'paid') return null;
  const date = order.paidAt ? new Date(order.paidAt) : new Date();
  const items = await withTaxInfo(order.items);
  const number = await allocateInvoiceNumber(order.orderId, date);
  order.invoice = { number, date: date.toISOString(), ...buildInvoiceBody(order, items) };
  await getStore('orders').setJSON(order.orderId, order);
  return order.invoice;
}

module.exports = { SUPPLIER, STATE_CODES, stateCodeFor, taxInfoFor, ensureInvoice };
