const { getStore } = require('../lib/blob-store');
const { requireAdmin } = require('../lib/admin-auth');
const { logEvent } = require('../lib/audit');
const { STATUSES, listEnquiries } = require('../lib/enquiries');

// Bulk enquiries for admin.html → Enquiries.
//   GET                                          -> { enquiries }
//   POST { action: 'update', key, status, note } -> set status / internal note
//   POST { action: 'delete', key }
exports.handler = async (event) => {
  const auth = await requireAdmin(event, 'enquiries');
  if (auth.response) return auth.response;
  const store = getStore('enquiries');
  try {
    if (event.httpMethod === 'GET') {
      return { statusCode: 200, body: JSON.stringify({ enquiries: await listEnquiries() }) };
    }
    if (event.httpMethod !== 'POST') return bad('Method Not Allowed', 405);

    const b = JSON.parse(event.body || '{}');
    if (!/^q\/[\w:.-]+$/.test(String(b.key || ''))) return bad('Bad enquiry key');
    const q = await store.get(b.key, { type: 'json' });
    if (!q) return bad('Enquiry not found', 404);

    if (b.action === 'update') {
      if (!STATUSES.includes(b.status)) return bad('Unknown status');
      q.status = b.status;
      q.adminNote = String(b.note || '').trim().slice(0, 1000) || null;
      q.updatedAt = new Date().toISOString();
      await store.setJSON(b.key, q);
    } else if (b.action === 'delete') {
      await store.delete(b.key);
    } else {
      return bad('Unknown action');
    }
    await logEvent(`enquiry_${b.action}`, 'admin', { key: b.key, status: b.status }, event);
    return { statusCode: 200, body: JSON.stringify({ enquiry: b.action === 'delete' ? null : q }) };
  } catch (err) {
    console.error(err);
    return bad('Enquiry update failed', 500);
  }
};

const bad = (error, statusCode = 400) => ({ statusCode, body: JSON.stringify({ error }) });
