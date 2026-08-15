const { getSessionUser } = require('../lib/session');

// Used everywhere the front-end needs to know "is someone logged in right now?" —
// nav account icon, checkout prefill, account.html gate. 401 = treat as guest, not an error.
exports.handler = async (event) => {
  try {
    const session = await getSessionUser(event);
    if (!session) return { statusCode: 401, body: JSON.stringify({ error: 'Not logged in' }) };

    const { user } = session;
    return {
      statusCode: 200,
      body: JSON.stringify({
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        emailVerified: user.emailVerified === true,
        addresses: user.addresses || [],
      }),
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Could not load profile' }) };
  }
};
