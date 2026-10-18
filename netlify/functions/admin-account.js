const bcrypt = require('bcryptjs');
const { getStore } = require('../lib/blob-store');
const { logEvent } = require('../lib/audit');
const { checkLoginLock, recordLoginFailure, clearLoginFailures } = require('../lib/rate-limit');
const {
  getAdmin, adminCount, createAdminSession, destroyAdminSession, adminCookie, clearAdminCookie,
  safeEqual, HEADER,
} = require('../lib/admin-auth');

// Admin sign-in and team management for admin.html. POST { action, ... }:
//   status          -> { setupNeeded, admin }            (no auth)
//   setup           { setupKey, name, email, password }  first owner; needs ADMIN_SECRET, only while no admins exist
//   login           { email, password }                  sets the admin session cookie
//   logout
//   change-password { current, next }
//   list-users | add-user { name, email, password, role } | remove-user { email }   (owner only)
const MIN_PASSWORD = 10;
// Compared against for unknown emails, so failed logins take the same time either way.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);
const norm = (e) => String(e || '').trim().toLowerCase();
const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const ok = (data, headers) => ({ statusCode: 200, headers, body: JSON.stringify(data) });
const bad = (error, statusCode = 400) => ({ statusCode, body: JSON.stringify({ error }) });
const publicUser = (u) => ({ email: u.email, name: u.name, role: u.role, createdAt: u.createdAt, lastLoginAt: u.lastLoginAt || null });

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  try {
    const body = JSON.parse(event.body || '{}');
    const users = getStore('admin-users');

    if (body.action === 'status') {
      return ok({ setupNeeded: (await adminCount()) === 0, admin: await getAdmin(event) });
    }

    // Everything below changes state: require the admin header (CSRF guard).
    const hasHeader = Object.keys(event.headers || {}).some((k) => k.toLowerCase() === HEADER);
    if (!hasHeader) return bad('Missing admin header', 403);

    if (body.action === 'setup') {
      if ((await adminCount()) > 0) return bad('Setup already done — sign in instead', 409);
      if (!process.env.ADMIN_SECRET || !safeEqual(body.setupKey, process.env.ADMIN_SECRET)) {
        await logEvent('admin_setup_failed', 'unknown', {}, event);
        return bad('Setup key is wrong', 401);
      }
      const email = norm(body.email);
      if (!validEmail(email)) return bad('Enter a valid email');
      if (String(body.password || '').length < MIN_PASSWORD) return bad(`Password must be at least ${MIN_PASSWORD} characters`);
      const user = { email, name: String(body.name || '').trim().slice(0, 60) || email, role: 'owner',
        passwordHash: await bcrypt.hash(String(body.password), 12), createdAt: new Date().toISOString() };
      await users.setJSON(email, user);
      await logEvent('admin_created', email, { role: 'owner', via: 'setup' }, event);
      const token = await createAdminSession(email);
      return ok({ admin: publicUser(user) }, { 'Set-Cookie': adminCookie(token) });
    }

    if (body.action === 'login') {
      const email = norm(body.email);
      if (!email || !body.password) return bad('Email and password are required');
      const lockKey = `admin:${email}`;
      const lock = await checkLoginLock(lockKey);
      if (lock.locked) return bad(`Too many failed attempts. Try again after ${new Date(lock.lockedUntil).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}.`, 429);
      const user = await users.get(email, { type: 'json' });
      // Same answer for unknown email and wrong password, and always run bcrypt so the
      // response time doesn't reveal which accounts exist.
      const hash = user && !user.disabled ? user.passwordHash : DUMMY_HASH;
      const match = await bcrypt.compare(String(body.password), hash);
      if (!user || user.disabled || !match) {
        await recordLoginFailure(lockKey);
        await logEvent('admin_login_failed', email, {}, event);
        return bad('Invalid email or password', 401);
      }
      await clearLoginFailures(lockKey);
      user.lastLoginAt = new Date().toISOString();
      await users.setJSON(email, user);
      const token = await createAdminSession(email);
      await logEvent('admin_login', email, {}, event);
      return ok({ admin: publicUser(user) }, { 'Set-Cookie': adminCookie(token) });
    }

    if (body.action === 'logout') {
      await destroyAdminSession(event);
      return ok({ ok: true }, { 'Set-Cookie': clearAdminCookie() });
    }

    // Signed-in actions.
    const admin = await getAdmin(event);
    if (!admin) return bad('Unauthorized', 401);

    if (body.action === 'change-password') {
      const user = await users.get(admin.email, { type: 'json' });
      if (!(await bcrypt.compare(String(body.current || ''), user.passwordHash))) return bad('Current password is wrong', 401);
      if (String(body.next || '').length < MIN_PASSWORD) return bad(`New password must be at least ${MIN_PASSWORD} characters`);
      user.passwordHash = await bcrypt.hash(String(body.next), 12);
      await users.setJSON(admin.email, user);
      await logEvent('admin_password_changed', admin.email, {}, event);
      return ok({ ok: true });
    }

    if (admin.role !== 'owner') return bad('Only the owner can manage the team', 403);
    const all = (await Promise.all((await users.list()).blobs.map((b) => users.get(b.key, { type: 'json' })))).filter(Boolean);

    if (body.action === 'list-users') return ok({ users: all.map(publicUser) });

    if (body.action === 'add-user') {
      const email = norm(body.email);
      if (!validEmail(email)) return bad('Enter a valid email');
      if (all.some((u) => u.email === email)) return bad('That email already has an admin account');
      if (String(body.password || '').length < MIN_PASSWORD) return bad(`Password must be at least ${MIN_PASSWORD} characters`);
      const role = body.role === 'owner' ? 'owner' : 'staff';
      await users.setJSON(email, { email, name: String(body.name || '').trim().slice(0, 60) || email, role,
        passwordHash: await bcrypt.hash(String(body.password), 12), createdAt: new Date().toISOString() });
      await logEvent('admin_created', admin.email, { email, role }, event);
      return ok({ users: [...all.map(publicUser), { email, name: body.name || email, role }] });
    }

    if (body.action === 'remove-user') {
      const email = norm(body.email);
      if (email === admin.email) return bad('You can\'t remove your own account');
      const target = all.find((u) => u.email === email);
      if (!target) return bad('No such admin', 404);
      if (target.role === 'owner' && all.filter((u) => u.role === 'owner').length < 2) return bad('Keep at least one owner');
      await users.delete(email);
      await logEvent('admin_removed', admin.email, { email }, event);
      return ok({ users: all.filter((u) => u.email !== email).map(publicUser) });
    }

    return bad('Unknown action');
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Admin account request failed' }) };
  }
};
