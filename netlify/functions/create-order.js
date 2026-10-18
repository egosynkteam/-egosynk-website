const Razorpay = require('razorpay');
const { getStore } = require('../lib/blob-store');
const { getSessionUser } = require('../lib/session');
const { logEvent } = require('../lib/audit');
const { stateCodeFor, taxInfoFor } = require('../lib/gst');
const { getSettings, getCategories, shippingFor } = require('../lib/settings');
const { stockLeft } = require('../lib/orders');
const { allowRequest } = require('../lib/rate-limit');
const { findAndEvaluate, allocateDiscount } = require('../lib/coupons');

const REQUIRED_SHIPPING_FIELDS = ['name', 'phone', 'email', 'address1', 'city', 'state', 'pincode'];

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    // Each attempt creates a real Razorpay order, so cap how fast one client can make them.
    if (!(await allowRequest('create-order', event, 20, 10 * 60 * 1000))) {
      return { statusCode: 429, body: JSON.stringify({ error: 'Too many checkout attempts — please wait a few minutes' }) };
    }
    const { cart, shipping, couponCode } = JSON.parse(event.body || '{}');

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
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(shipping.email).trim())) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Enter a valid email address' }) };
    }
    if (!/^[6-9]\d{9}$/.test(shipping.phone)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Enter a valid 10-digit mobile number' }) };
    }
    // Place of supply decides CGST+SGST vs IGST on the tax invoice, so it must be a real state.
    const stateCode = stateCodeFor(shipping.state);
    if (!stateCode) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Select a valid state' }) };
    }

    // Prices AND availability are read live from the `catalog` store — the same store the
    // admin portal writes to — so a price change or "mark sold out" in the admin portal is
    // enforced at checkout immediately, not just reflected in the storefront's display.
    const catalogStore = getStore('catalog');
    const categories = await getCategories();
    let amount = 0;
    let items = [];
    const products = {};
    for (const item of cart) {
      const product = await catalogStore.get(String(item.id), { type: 'json' });
      // Hidden products are off the storefront, so they can't be bought either.
      const cat = categories.find((c) => c.id === (product && product.cat));
      if (!product || product.visible === false || (cat && cat.visible === false) ||
          !Number.isInteger(item.qty) || item.qty <= 0) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Invalid cart item' }) };
      }
      if (product.available === false) {
        return { statusCode: 400, body: JSON.stringify({ error: `${product.name} is currently sold out` }) };
      }
      const left = stockLeft(product, item.size);
      if (left < item.qty) {
        const what = `${product.name}${item.size ? ' (' + item.size + ')' : ''}`;
        return { statusCode: 400, body: JSON.stringify({ error: left > 0 ? `Only ${left} left of ${what}` : `${what} is sold out` }) };
      }
      amount += product.price * item.qty;
      products[item.id] = product;
      items.push({
        id: item.id,
        name: product.name,
        size: item.size ? String(item.size).slice(0, 20) : null,
        qty: item.qty,
        price: product.price,
        cat: product.cat,
      });
    }

    const subtotal = amount;

    // The coupon is re-checked here (never trusted from the bag), split across the items,
    // and each item's GST is then worked out on its discounted value.
    let discount = 0;
    let coupon = null;
    if (couponCode) {
      const result = await findAndEvaluate(couponCode, subtotal);
      if (result.error) return { statusCode: 400, body: JSON.stringify({ error: result.error }) };
      discount = result.discount;
      coupon = result.coupon.code;
    }
    items = allocateDiscount(items, discount).map((i) => ({
      ...i,
      ...taxInfoFor(products[i.id], (i.price * i.qty - i.discount) / i.qty, categories),
    }));

    // Free shipping is judged on what the customer actually pays for the goods.
    const shippingFee = shippingFor(subtotal - discount, await getSettings());
    amount = subtotal - discount + shippingFee;

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
      subtotal,
      discount,
      coupon,
      shippingFee,
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
        stateCode,
        pincode: shipping.pincode,
      },
      paymentId: null,
      createdAt: new Date().toISOString(),
      paidAt: null,
    });

    await logEvent('order_created', session ? session.user.email : (shipping.email || 'guest'), { orderId: order.id, amount: amount * 100 }, event);

    return {
      statusCode: 200,
      // The browser must open checkout with the same key that created the order, so it
      // takes the key id from here rather than a copy hardcoded in index.html.
      body: JSON.stringify({ orderId: order.id, amount: order.amount, keyId: process.env.RAZORPAY_KEY_ID }),
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Could not create order' }) };
  }
};
