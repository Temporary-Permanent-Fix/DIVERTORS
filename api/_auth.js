// Shared-password session. Cookie = "<expiry>.<HMAC(expiry)>", key derived from APP_PASSWORD,
// so changing the password invalidates every existing session.
import crypto from 'node:crypto';

const COOKIE = 'dv_s';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function key() {
  const p = process.env.APP_PASSWORD;
  if (!p) throw new Error('APP_PASSWORD is not set');
  return crypto.createHash('sha256').update('divertory-session:' + p).digest();
}

function sign(exp) {
  return crypto.createHmac('sha256', key()).update(String(exp)).digest('base64url');
}

export function configured() {
  return !!process.env.APP_PASSWORD;
}

export function checkPassword(pw) {
  if (!configured() || typeof pw !== 'string') return false;
  const a = crypto.createHash('sha256').update(pw).digest();
  const b = crypto.createHash('sha256').update(process.env.APP_PASSWORD).digest();
  return crypto.timingSafeEqual(a, b);
}

export function sessionCookie() {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  return `${COOKIE}=${exp}.${sign(exp)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${MAX_AGE}`;
}

export function clearCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export function isAuthed(req) {
  if (!configured()) return false;
  const m = /(?:^|;\s*)dv_s=(\d+)\.([\w-]+)/.exec(req.headers.cookie || '');
  if (!m || Number(m[1]) < Date.now() / 1000) return false;
  const a = Buffer.from(m[2]);
  const b = Buffer.from(sign(m[1]));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
