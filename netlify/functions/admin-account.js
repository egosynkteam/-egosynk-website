const bcrypt = require('bcryptjs');
const { getStore } = require('../lib/blob-store');
const { logEvent } = require('../lib/audit');
const { checkLoginLock, recordLoginFailure, clearLoginFailures, allowRequest } = require('../lib/rate-limit');
const {
  getAdmin, adminCount, createAdminSession, destroyAdminSession, revokeSessions, adminCookie, clearAdminCookie,
  safeEqual, HEADER, PERMISSIONS, STAFF_DEFAULT, permissionsOf,
} = require('../lib/admin-auth');
const { createToken, consumeToken } = require('../lib/tokens');
const { sendEmail, emailWrapper, buttonHtml } = require('../lib/email');

// Admin sign-in and team management for admin.html. POST { action, ... }:
//   status          -> { setupNeeded, admin }            (no auth)
//   setup           { setupKey, name, email, password }  first owner; needs ADMIN_SECRET, only while no admins exist
//   login           { email, password }                  sets the admin session cookie
//   logout
//   change-password { current, next }       also signs out the account's other sessions
//   logout-all                              signs out every session of this account
//   request-reset   { email }               emails a 1-hour reset link (no auth; same answer either way)
//   reset-password  { token, password }     from that link
//   recover         { setupKey, email, password }  owner password reset with ADMIN_SECRET,
//                                           for when email isn't working (break-glass)
//   list-users | add-user { name, email, password, role, permissions } | remove-user { email }
//   update-user { email, role, permissions, disabled } | set-password { email, password }  (owner only)
const MIN_PASSWORD = 10;
// Compared against for unknown emails, so failed logins take the same time either way.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);
const norm = (e) => String(e || '').trim().toLowerCase();
const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const ok = (data, headers) => ({ statusCode: 200, headers, body: JSON.stringify(data) });
const bad = (error, statusCode = 400) => ({ statusCode, body: JSON.stringify({ error }) });
const publicUser = (u) => ({ email: u.email, name: u.name, role: u.role, permissions: permissionsOf(u),
  disabled: !!u.disabled, createdAt: u.createdAt, lastLoginAt: u.lastLoginAt || null });
const cleanPermissions = (list) => [...new Set((Array.isArray(list) ? list : STAFF_DEFAULT).filter((p) => PERMISSIONS[p]))];

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

    if (body.action === 'request-reset') {
      if (!(await allowRequest('admin-reset', event, 5, 60 * 60 * 1000))) return bad('Too many requests — try again later', 429);
      const email = norm(body.email);
      const user = validEmail(email) ? await users.get(email, { type: 'json' }) : null;
      if (user && !user.disabled) {
        const token = await createToken('admin-resets', { email }, 60 * 60 * 1000);
        await sendEmail({
          to: email, subject: 'Reset your EGOSYNK admin password',
          html: emailWrapper(`<p style="font-size:14px;line-height:1.6;">Someone asked to reset the admin password for ${email}. The link works once, for 1 hour.</p>
            ${buttonHtml(`https://egosynk.com/admin.html#reset=${token}`, 'Choose a new password')}
            <p style="font-size:12px;color:#8B8D93;">Didn't ask for this? Ignore this email; your password stays the same.</p>`),
        });
        await logEvent('admin_reset_requested', email, {}, event);
      }
      // Same reply whether or not the account exists.
      return ok({ ok: true });
    }

    if (body.action === 'reset-password') {
      if (String(body.password || '').length < MIN_PASSWORD) return bad(`Password must be at least ${MIN_PASSWORD} characters`);
      const rec = await consumeToken('admin-resets', String(body.token || ''));
      if (!rec) return bad('This reset link has expired or was already used. Ask for a new one.', 400);
      const user = await users.get(rec.email, { type: 'json' });
      if (!user || user.disabled) return bad('This account no longer exists', 400);
      user.passwordHash = await bcrypt.hash(String(body.password), 12);
      await users.setJSON(user.email, user);
      await revokeSessions(user.email);
      await clearLoginFailures(`admin:${user.email}`);
      await logEvent('admin_password_reset', user.email, { via: 'email' }, event);
      return ok({ ok: true });
    }

    // Break-glass: whoever holds ADMIN_SECRET (set in Netlify) can reset an owner's
    // password. Locked out like logins after repeated wrong keys.
    if (body.action === 'recover') {
      const lockKey = 'admin-recover';
      const lock = await checkLoginLock(lockKey);
      if (lock.locked) return bad('Too many wrong attempts. Try again later.', 429);
      if (!process.env.ADMIN_SECRET || !safeEqual(body.setupKey, process.env.ADMIN_SECRET)) {
        await recordLoginFailure(lockKey);
        await logEvent('admin_recover_failed', norm(body.email) || 'unknown', {}, event);
        return bad('Setup key is wrong', 401);
      }
      const user = await users.get(norm(body.email), { type: 'json' });
      if (!user || user.role !== 'owner') return bad('No owner account with that email', 404);
      if (String(body.password || '').length < MIN_PASSWORD) return bad(`Password must be at least ${MIN_PASSWORD} characters`);
      user.passwordHash = await bcrypt.hash(String(body.password), 12);
      user.disabled = false;
      await users.setJSON(user.email, user);
      await revokeSessions(user.email);
      await clearLoginFailures(lockKey);
      await clearLoginFailures(`admin:${user.email}`);
      await logEvent('admin_password_reset', user.email, { via: 'setup-key' }, event);
      return ok({ ok: true });
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
      const ended = await revokeSessions(admin.email, event);
      await logEvent('admin_password_changed', admin.email, { otherSessionsEnded: ended }, event);
      return ok({ ok: true, otherSessionsEnded: ended });
    }

    if (body.action === 'logout-all') {
      const ended = await revokeSessions(admin.email);
      await logEvent('admin_logout_all', admin.email, { sessions: ended }, event);
      return ok({ ok: true }, { 'Set-Cookie': clearAdminCookie() });
    }

    if (admin.role !== 'owner') return bad('Only the owner can manage the team', 403);
    const all = (await users.listValues()).map((r) => r.value);

    if (body.action === 'list-users') return ok({ users: all.map(publicUser) });

    if (body.action === 'add-user') {
      const email = norm(body.email);
      if (!validEmail(email)) return bad('Enter a valid email');
      if (all.some((u) => u.email === email)) return bad('That email already has an admin account');
      if (String(body.password || '').length < MIN_PASSWORD) return bad(`Password must be at least ${MIN_PASSWORD} characters`);
      const role = body.role === 'owner' ? 'owner' : 'staff';
      const created = { email, name: String(body.name || '').trim().slice(0, 60) || email, role,
        permissions: cleanPermissions(body.permissions),
        passwordHash: await bcrypt.hash(String(body.password), 12), createdAt: new Date().toISOString() };
      await users.setJSON(email, created);
      await logEvent('admin_created', admin.email, { email, role, permissions: created.permissions }, event);
      return ok({ users: [...all, created].map(publicUser) });
    }

    if (body.action === 'update-user' || body.action === 'set-password') {
      const email = norm(body.email);
      const target = all.find((u) => u.email === email);
      if (!target) return bad('No such admin', 404);
      if (body.action === 'set-password') {
        if (String(body.password || '').length < MIN_PASSWORD) return bad(`Password must be at least ${MIN_PASSWORD} characters`);
        target.passwordHash = await bcrypt.hash(String(body.password), 12);
        await users.setJSON(email, target);
        await revokeSessions(email);
        await logEvent('admin_password_set', admin.email, { email }, event);
        return ok({ users: all.map(publicUser) });
      }
      const role = body.role === 'owner' ? 'owner' : 'staff';
      const owners = all.filter((u) => u.role === 'owner' && !u.disabled);
      if (target.role === 'owner' && (role !== 'owner' || body.disabled) && owners.length < 2) return bad('Keep at least one active owner');
      if (email === admin.email && (role !== 'owner' || body.disabled)) return bad('You can\'t demote or disable your own account');
      Object.assign(target, { role, permissions: cleanPermissions(body.permissions), disabled: !!body.disabled });
      await users.setJSON(email, target);
      if (target.disabled) await revokeSessions(email);
      await logEvent('admin_updated', admin.email, { email, role, permissions: target.permissions, disabled: target.disabled }, event);
      return ok({ users: all.map(publicUser) });
    }

    if (body.action === 'remove-user') {
      const email = norm(body.email);
      if (email === admin.email) return bad('You can\'t remove your own account');
      const target = all.find((u) => u.email === email);
      if (!target) return bad('No such admin', 404);
      if (target.role === 'owner' && all.filter((u) => u.role === 'owner').length < 2) return bad('Keep at least one owner');
      await users.delete(email);
      await revokeSessions(email);
      await logEvent('admin_removed', admin.email, { email }, event);
      return ok({ users: all.filter((u) => u.email !== email).map(publicUser) });
    }

    return bad('Unknown action');
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Admin account request failed' }) };
  }
};
