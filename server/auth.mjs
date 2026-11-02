import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
const derive = promisify(scrypt);
export const token = () => randomBytes(32).toString('base64url');
export const digest = value => createHash('sha256').update(value).digest('hex');
export const usernameValid = value => typeof value === 'string' && /^[a-z0-9][a-z0-9._-]{2,39}$/.test(value);
export const passwordValid = value => typeof value === 'string' && value.length >= 16 && Buffer.byteLength(value) <= 256;

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await derive(password, salt, 64);
  return `scrypt:${salt}:${key.toString('hex')}`;
}
export async function verifyPassword(password, encoded) {
  const [, salt, expected] = (encoded || '').split(':');
  const key = await derive(password, salt || 'relax-no-user', 64);
  const check = Buffer.from(expected || '00'.repeat(64), 'hex');
  return check.length === key.length && timingSafeEqual(key, check);
}

export function readSession(db, req, cookieName) {
  const raw = (req.headers.cookie || '').split(';').map(p => p.trim()).find(p => p.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
  if (!raw || !/^[A-Za-z0-9_-]{43}$/.test(raw)) return null;
  return db.prepare(`SELECT users.id, users.username, users.role, sessions.csrf, sessions.token_hash
    FROM sessions JOIN users ON users.id=sessions.user_id WHERE token_hash=? AND expires_at>?`).get(digest(raw), Date.now()) || null;
}
export function newSession(db, user, production, cookieName) {
  const raw = token(), csrf = token();
  db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(Date.now());
  db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);
  db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(digest(raw), user.id, csrf, Date.now() + 8 * 3600000);
  return { csrf, cookie: cookie(cookieName, raw, production, 28800) };
}
export function cookie(name, value, production, maxAge = 0) {
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${production ? '; Secure' : ''}`;
}
export function allowLogin(db, key) {
  const now = Date.now();
  db.prepare('DELETE FROM auth_attempts WHERE resets_at<=?').run(now);
  const item = db.prepare('SELECT attempts FROM auth_attempts WHERE key=?').get(key);
  if (item && item.attempts >= 10) return false;
  db.prepare(`INSERT INTO auth_attempts VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=attempts+1`).run(key, now + 600000);
  return true;
}
