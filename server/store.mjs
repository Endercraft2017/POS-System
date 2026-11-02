import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { migrate, platformMigrations, tenantMigrations } from './migrations.mjs';
import { hashPassword, verifyPassword, usernameValid, passwordValid } from './auth.mjs';

const reserved = new Set(['api','assets','admin','app','console','demo','login','logout','signup','register','health','status','support','help','docs','blog','privacy','terms','www','favicon','robots','sitemap']);
export const validSlug = slug => typeof slug === 'string' && /^[a-z][a-z0-9-]{1,46}[a-z0-9]$/.test(slug) && !reserved.has(slug) && !slug.includes('--');
export const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
export function field(value, name, max, required = false) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) fail(400, `Check ${name}.`);
  return value.trim();
}
export function transaction(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try { const result = fn(); db.exec('COMMIT'); return result; } catch(error) { db.exec('ROLLBACK'); throw error; }
}

export class Store {
  constructor(dataDir) {
    this.dir = resolve(dataDir); this.connections = new Map();
    mkdirSync(join(this.dir, 'tenants'), { recursive: true, mode: 0o700 });
    this.platform = this.open(join(this.dir, 'platform.db'), platformMigrations);
    // Migrate every registered tenant before readiness; never silently replace missing data.
    try {
      for (const tenant of this.listTenants().filter(t => ['active','suspended'].includes(t.status))) this.tenant(tenant.id);
    } catch(error) { this.close(); throw error; }
  }
  open(file, steps) {
    const db = new DatabaseSync(file);
    try {
      db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA synchronous=FULL;');
      migrate(db, file, steps, join(this.dir, 'backups', 'migrations'));
      return db;
    } catch(error) { db.close(); throw error; }
  }
  listTenants() { return this.platform.prepare('SELECT * FROM tenants ORDER BY created_at DESC').all(); }
  bySlug(slug) { return validSlug(slug) ? this.platform.prepare('SELECT * FROM tenants WHERE slug=?').get(slug) : null; }
  tenant(id) {
    const row = this.platform.prepare('SELECT id FROM tenants WHERE id=?').get(id);
    if (!row) fail(404, 'Café not found.');
    if (this.connections.has(id)) return this.connections.get(id);
    const file = join(this.dir, 'tenants', `${row.id}.db`);
    if (!existsSync(file)) throw new Error('Registered tenant database is missing. Restore storage before serving requests.');
    const db = this.open(file, tenantMigrations); this.connections.set(id, db); return db;
  }
  async bootstrap(username, password) {
    if (!username && !password) return false;
    if (!usernameValid(username) || !passwordValid(password)) throw new Error('Set CONSOLE_USERNAME (3–40 lowercase characters) and CONSOLE_PASSWORD (16–256 characters).');
    const old = this.platform.prepare('SELECT * FROM users WHERE username=?').get(username);
    if (old && await verifyPassword(password, old.password_hash)) return true;
    if (!old && this.platform.prepare('SELECT COUNT(*) n FROM users').get().n) throw new Error('Console username differs from the existing operator. Use the existing username.');
    const hash = await hashPassword(password);
    transaction(this.platform, () => {
      if (old) {
        this.platform.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hash, old.id);
        this.platform.prepare('DELETE FROM sessions WHERE user_id=?').run(old.id);
      } else this.platform.prepare('INSERT INTO users VALUES(?,?,?,?)').run(randomUUID(), username, hash, 'operator');
    });
    return true;
  }
  audit(actor, action, tenantId, detail = {}) {
    this.platform.prepare('INSERT INTO audit(actor,action,tenant_id,detail,at) VALUES(?,?,?,?,?)').run(actor, action, tenantId, JSON.stringify(detail), new Date().toISOString());
  }
  async createTenant(input, actor) {
    const slug = input.slug;
    if (!validSlug(slug)) fail(400, 'Use a unique café URL: 3–48 lowercase letters, numbers or single hyphens.');
    const name = field(input.name, 'café name', 100, true);
    const username = input.username;
    if (!usernameValid(username) || !passwordValid(input.password)) fail(400, 'Use a 3–40 character lowercase owner username and a password of at least 16 characters.');
    if (this.bySlug(slug)) fail(409, 'That café URL is already taken.');
    const hash = await hashPassword(input.password);
    // Check again after async work, before the unique insert.
    if (this.bySlug(slug)) fail(409, 'That café URL is already taken.');
    const id = randomUUID(), at = new Date().toISOString();
    this.platform.prepare('INSERT INTO tenants(id,slug,name,plan,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').run(id, slug, name, 'free', 'provisioning', at, at);
    let db;
    try {
      db = this.open(join(this.dir, 'tenants', `${id}.db`), tenantMigrations);
      transaction(db, () => {
        const branch = randomUUID(), owner = randomUUID();
        db.prepare('INSERT INTO branches VALUES(?,?,?)').run(branch, 'Main branch', at);
        db.prepare('INSERT INTO users VALUES(?,?,?,?)').run(owner, username, hash, 'owner');
        db.prepare('INSERT INTO memberships VALUES(?,?)').run(owner, branch);
      });
      transaction(this.platform, () => {
        this.platform.prepare("UPDATE tenants SET status='active' WHERE id=?").run(id);
        this.audit(actor, 'tenant.created', id, { slug });
      });
      this.connections.set(id, db);
      return this.bySlug(slug);
    } catch(error) {
      db?.close();
      this.platform.prepare("UPDATE tenants SET status='failed' WHERE id=?").run(id);
      this.audit(actor, 'tenant.provision_failed', id);
      throw error;
    }
  }
  updateTenant(slug, input, actor) {
    const tenant = this.bySlug(slug); if (!tenant) fail(404, 'Café not found.');
    if (!['active','suspended'].includes(tenant.status)) fail(409, 'Provisioning needs operator recovery.');
    if (!['active','suspended'].includes(input.status) || !['free','paid'].includes(input.plan)) fail(400, 'Check the status and plan.');
    if (typeof input.websiteEnabled !== 'boolean') fail(400, 'Check website publishing.');
    if (input.websiteEnabled && input.plan !== 'paid') fail(400, 'Website publishing requires the paid entitlement.');
    const productLimit = input.plan === 'free' ? 20 : input.productLimit;
    const locationLimit = input.plan === 'free' ? 1 : input.locationLimit;
    if (!Number.isInteger(productLimit) || productLimit < 1 || productLimit > 10000 || !Number.isInteger(locationLimit) || locationLimit < 1 || locationLimit > 100) fail(400, 'Check granted product and location limits.');
    const db = this.tenant(tenant.id);
    if (db.prepare('SELECT COUNT(*) n FROM products WHERE active=1').get().n > productLimit || db.prepare('SELECT COUNT(*) n FROM branches').get().n > locationLimit) fail(409, 'Current usage exceeds the new allowance. Archive products or resolve locations before downgrading.');
    transaction(this.platform, () => {
      this.platform.prepare('UPDATE tenants SET plan=?,status=?,website_enabled=?,product_limit=?,location_limit=?,updated_at=? WHERE id=?').run(input.plan, input.status, input.websiteEnabled ? 1 : 0, productLimit, locationLimit, new Date().toISOString(), tenant.id);
      this.audit(actor, 'tenant.updated', tenant.id, {plan:input.plan,status:input.status,websiteEnabled:input.websiteEnabled,productLimit,locationLimit});
      if (input.status === 'suspended') db.exec('DELETE FROM sessions');
    });
    return this.bySlug(slug);
  }
  close() { for(const db of this.connections.values()) db.close(); this.platform.close(); }
}
