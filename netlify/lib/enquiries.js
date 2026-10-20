const { getStore } = require('./blob-store');
const { sendEmail, emailWrapper, escapeHtml } = require('./email');

// Bulk / team enquiries from bulk.html, kept in the `enquiries` store as q/<time>-<rand>
// and worked through in admin → Enquiries.
const TYPES = { gym: 'Gym / studio', coach: 'Coach / trainer', team: 'Sports team / club', corporate: 'Corporate / event', other: 'Other' };
const QUANTITIES = ['10–25', '26–50', '51–100', '100+'];
const STATUSES = ['new', 'contacted', 'quoted', 'won', 'lost'];
const OWNER_EMAIL = 'egosynkteam@gmail.com';

async function listEnquiries() {
  const list = (await getStore('enquiries').listValues({ prefix: 'q/' })).map((r) => r.value);
  return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function emailNewEnquiry(q) {
  const rows = [
    ['Name', q.name], ['Organisation', q.org], ['Type', TYPES[q.type]], ['Email', q.email], ['Phone', q.phone],
    ['City', q.city], ['Products', q.categories.join(', ')], ['Quantity', q.quantity], ['Logo / branding', q.branding ? 'Yes' : 'No'],
  ].filter(([, v]) => v);
  const owner = `
    <p style="font-size:14px;line-height:1.6;"><strong>New bulk enquiry.</strong> Follow it up in admin → Enquiries.</p>
    <table style="font-size:13px;border-collapse:collapse;">${rows.map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#8B8D93;">${k}</td><td style="padding:4px 0;">${escapeHtml(v)}</td></tr>`).join('')}</table>
    ${q.message ? `<p style="font-size:13px;line-height:1.6;">${escapeHtml(q.message)}</p>` : ''}`;
  const customer = `
    <p style="font-size:14px;line-height:1.6;">Thanks, ${escapeHtml(q.name)}. We've got your bulk enquiry${q.org ? ' for ' + escapeHtml(q.org) : ''}.</p>
    <p style="font-size:14px;line-height:1.6;">We'll reply within 1 working day with pricing and sizing options. Just reply to this email if you want to add anything.</p>`;
  await sendEmail({ to: OWNER_EMAIL, subject: `Bulk enquiry — ${q.org || q.name} (${q.quantity})`, html: emailWrapper(owner) });
  await sendEmail({ to: q.email, subject: 'We got your bulk enquiry — EGOSYNK', html: emailWrapper(customer) });
}

module.exports = { TYPES, QUANTITIES, STATUSES, listEnquiries, emailNewEnquiry };
