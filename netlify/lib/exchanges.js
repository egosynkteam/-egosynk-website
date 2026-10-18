const { sendEmail, emailWrapper, escapeHtml } = require('./email');

// Exchange / issue requests a customer raises from My Orders on a delivered order.
// The windows mirror refund-policy.html: a size exchange within 7 days of delivery,
// damaged or wrong items within 48 hours. One request per order; a rejected one can be
// raised again while the window is still open.
const REASONS = {
  size: { label: 'Wrong size / fit', hours: 7 * 24 },
  damaged: { label: 'Arrived damaged', hours: 48 },
  wrong_item: { label: "Not what I ordered", hours: 48 },
};
const ADMIN_STATUSES = ['approved', 'rejected', 'completed'];
const OWNER_EMAIL = 'egosynkteam@gmail.com';

function deliveredAt(order) {
  const history = (order.fulfilment && order.fulfilment.history) || [];
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].status === 'delivered') return history[i].at;
  }
  return order.fulfilment && order.fulfilment.status === 'delivered' ? order.fulfilment.updatedAt : null;
}

// Which reasons the customer may still pick, with each one's deadline. Empty when the
// order isn't delivered, a request is already open, or every window has passed.
function openReasons(order, now = Date.now()) {
  if (order.status !== 'paid' || !order.fulfilment || order.fulfilment.status !== 'delivered') return [];
  if (order.exchange && order.exchange.status !== 'rejected') return [];
  const at = deliveredAt(order);
  if (!at) return [];
  return Object.entries(REASONS)
    .map(([id, r]) => ({ id, label: r.label, until: new Date(new Date(at).getTime() + r.hours * 3600 * 1000).toISOString() }))
    .filter((r) => new Date(r.until).getTime() > now);
}

// What the customer sees on their order card — never the admin's internal history.
function customerView(exchange) {
  if (!exchange) return null;
  return {
    status: exchange.status,
    reason: REASONS[exchange.reason] ? REASONS[exchange.reason].label : exchange.reason,
    items: exchange.items,
    note: exchange.adminNote || null,
  };
}

function itemsHtml(items) {
  return items
    .map((i) => `${escapeHtml(i.name)} (${escapeHtml(i.size || '—')})${i.newSize ? ' → ' + escapeHtml(i.newSize) : ''} × ${i.qty}`)
    .join('<br>');
}

async function emailRequestReceived(order) {
  const ex = order.exchange;
  const isIssue = ex.reason !== 'size';
  const customer = `
    <p style="font-size:14px;line-height:1.6;">We've got your request, ${escapeHtml(order.shipping.name)}.</p>
    <p style="font-size:13px;line-height:1.6;">${escapeHtml(REASONS[ex.reason].label)}<br>${itemsHtml(ex.items)}</p>
    ${isIssue ? '<p style="font-size:14px;line-height:1.6;"><strong>Please reply to this email with photos of the item and its packaging</strong> so we can sort it out fast.</p>' : '<p style="font-size:14px;line-height:1.6;">Please keep the item unused with its tags. We\'ll reply with pickup or return details, usually within 1 working day.</p>'}
    <p style="font-size:12px;color:#8B8D93;">Order ID: ${escapeHtml(order.orderId)}</p>`;
  const owner = `
    <p style="font-size:14px;line-height:1.6;"><strong>New ${isIssue ? 'issue' : 'exchange'} request.</strong> Review it in admin → Orders.</p>
    <p style="font-size:13px;line-height:1.6;">${escapeHtml(REASONS[ex.reason].label)}<br>${itemsHtml(ex.items)}</p>
    ${ex.note ? `<p style="font-size:13px;line-height:1.6;">Customer note: ${escapeHtml(ex.note)}</p>` : ''}
    <p style="font-size:12px;color:#8B8D93;">Order ID: ${escapeHtml(order.orderId)}<br>${escapeHtml(order.shipping.name)} · ${escapeHtml(order.shipping.phone)} · ${escapeHtml(order.shipping.email || '')}</p>`;

  if (order.shipping.email) {
    await sendEmail({ to: order.shipping.email, subject: `Request received — ${order.orderId}`, html: emailWrapper(customer) });
  }
  await sendEmail({ to: OWNER_EMAIL, subject: `${isIssue ? 'Issue' : 'Exchange'} request — ${order.orderId}`, html: emailWrapper(owner) });
}

async function emailStatusUpdate(order) {
  const ex = order.exchange;
  if (!order.shipping.email) return { sent: false, reason: 'no_email' };
  const lead = {
    approved: 'Your request is approved.',
    rejected: "We couldn't approve your request.",
    completed: 'Your exchange is complete — the replacement is on its way or already with you.',
  }[ex.status];
  const html = `
    <p style="font-size:14px;line-height:1.6;">${lead}</p>
    ${ex.adminNote ? `<p style="font-size:14px;line-height:1.6;">${escapeHtml(ex.adminNote)}</p>` : ''}
    <p style="font-size:13px;line-height:1.6;">${itemsHtml(ex.items)}</p>
    <p style="font-size:12px;color:#8B8D93;">Order ID: ${escapeHtml(order.orderId)} · Questions? Just reply to this email.</p>`;
  return sendEmail({ to: order.shipping.email, subject: `Exchange ${ex.status} — ${order.orderId}`, html: emailWrapper(html) });
}

module.exports = { REASONS, ADMIN_STATUSES, openReasons, customerView, emailRequestReceived, emailStatusUpdate };
