const Razorpay = require('razorpay');
const { getStore } = require('../lib/blob-store');
const { getSessionUser } = require('../lib/session');
const { logEvent } = require('../lib/audit');

const REQUIRED_SHIPPING_FIELDS = ['name', 'phone', 'address1', 'city', 'state', 'pincode'];

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { cart, shipping } = JSON.parse(event.body || '{}');

    // Optional: if the buyer is logged in, the order gets tied to their account for
    // order history (my-orders.js). Guest checkout (no session) still works fine —
    // userId just stays null, exactly like an unregistered customer should.
    const session = await getSessionUser(event);

    if (!Array.isArray(cart) || cart.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Cart is empty' }) };
    }

    for (const field of REQUIRED_SHIPPING_FIELDS) {
      if (!shipping || !String(shipping[field] || '').trim()) {
        return { statusCode: 400, body: JSON.stringify({ error: `Missing shipping field: ${field}` }) };
      }
    }
    if (!/^\d{6}$/.test(shipping.pincode)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Enter a valid 6-digit pincode' }) };
    }
    if (!/^[6-9]\d{9}$/.test(shipping.phone)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Enter a valid 10-digit mobile number' }) };
    }

    // Prices AND availability are read live from the `catalog` store — the same store the
    // admin portal writes to — so a price change or "mark sold out" in the admin portal is
    // enforced at checkout immediately, not just reflected in the storefront's display.
    const catalogStore = getStore('catalog');
    let amount = 0;
    const items = [];
    for (const item of cart) {
      const product = await catalogStore.get(String(item.id), { type: 'json' });
      if (!product || !Number.isInteger(item.qty) || item.qty <= 0) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Invalid cart item' }) };
      }
      if (product.available === false) {
        return { statusCode: 400, body: JSON.stringify({ error: `${product.name} is currently sold out` }) };
      }
      amount += product.price * item.qty;
      items.push({
        id: item.id,
        name: product.name,
        size: item.size ? String(item.size).slice(0, 20) : null,
        qty: item.qty,
        price: product.price,
      });
    }

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const order = await razorpay.orders.create({
      amount: amount * 100, // Razorpay expects paise
      currency: 'INR',
      receipt: `egosynk_${Date.now()}`,
    });

    // Record the order as pending BEFORE payment, so even an abandoned/failed checkout
    // leaves a lead you can follow up on — not just successful ones.
    const store = getStore('orders');
    await store.setJSON(order.id, {
      orderId: order.id,
      status: 'pending',
      userId: session ? session.user.id : null,
      items,
      amount: amount * 100,
      currency: 'INR',
      shipping: {
        name: String(shipping.name).slice(0, 120),
        phone: shipping.phone,
        email: (shipping.email || (session ? session.user.email : null)) ?
          String(shipping.email || session.user.email).slice(0, 200) : null,
        address1: String(shipping.address1).slice(0, 200),
        address2: shipping.address2 ? String(shipping.address2).slice(0, 200) : null,
        city: String(shipping.city).slice(0, 100),
        state: String(shipping.state).slice(0, 100),
        pincode: shipping.pincode,
      },
      paymentId: null,
      createdAt: new Date().toISOString(),
      paidAt: null,
    });

    await logEvent('order_created', session ? session.user.email : (shipping.email || 'guest'), { orderId: order.id, amount: amount * 100 }, event);

    return {
      statusCode: 200,
      body: JSON.stringify({ orderId: order.id, amount: order.amount }),
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Could not create order' }) };
  }
};
