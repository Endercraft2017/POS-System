import { existsSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { randomUUID } from 'node:crypto';

export const platformMigrations = [{ version: 1, sql: `
  CREATE TABLE tenants (
    id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
    plan TEXT NOT NULL CHECK(plan IN ('free','paid')),
    status TEXT NOT NULL CHECK(status IN ('provisioning','active','suspended','failed')),
    website_enabled INTEGER NOT NULL DEFAULT 0 CHECK(website_enabled IN (0,1)),
    product_limit INTEGER NOT NULL DEFAULT 20 CHECK(product_limit BETWEEN 1 AND 10000),
    location_limit INTEGER NOT NULL DEFAULT 1 CHECK(location_limit BETWEEN 1 AND 100),
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  ) STRICT;
  CREATE TABLE users (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role='operator')) STRICT;
  CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), csrf TEXT NOT NULL, expires_at INTEGER NOT NULL) STRICT;
  CREATE INDEX session_expiry ON sessions(expires_at);
  CREATE TABLE auth_attempts (key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, resets_at INTEGER NOT NULL) STRICT;
  CREATE TABLE audit (id INTEGER PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL, tenant_id TEXT, detail TEXT NOT NULL, at TEXT NOT NULL) STRICT;
` }];

export const tenantMigrations = [{ version: 1, sql: `
  CREATE TABLE profile (id INTEGER PRIMARY KEY CHECK(id=1), description TEXT NOT NULL DEFAULT '', address TEXT NOT NULL DEFAULT '', hours TEXT NOT NULL DEFAULT '') STRICT;
  INSERT INTO profile(id) VALUES(1);
  CREATE TABLE branches (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL) STRICT;
  CREATE TABLE users (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('owner','manager','cashier'))) STRICT;
  CREATE TABLE memberships (user_id TEXT NOT NULL REFERENCES users(id), branch_id TEXT NOT NULL REFERENCES branches(id), PRIMARY KEY(user_id,branch_id)) STRICT;
  CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), csrf TEXT NOT NULL, expires_at INTEGER NOT NULL) STRICT;
  CREATE INDEX session_expiry ON sessions(expires_at);
  CREATE TABLE auth_attempts (key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, resets_at INTEGER NOT NULL) STRICT;
  CREATE TABLE products (id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, description TEXT NOT NULL, price INTEGER NOT NULL CHECK(price BETWEEN 0 AND 100000000), active INTEGER NOT NULL CHECK(active IN (0,1)), created_at TEXT NOT NULL) STRICT;
  CREATE TABLE audit (id INTEGER PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL, detail TEXT NOT NULL, at TEXT NOT NULL) STRICT;
` }];

// Startup owns migrations. Railway pre-deploy containers cannot access the mounted volume.
// Snapshot the complete live SQLite database, including WAL, before any schema upgrade.
export function migrate(db, file, migrations, backupDir) {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL) STRICT');
  const current = db.prepare('SELECT COALESCE(MAX(version),0) AS version FROM schema_migrations').get().version;
  const latest = migrations.at(-1)?.version || 0;
  if (current > latest) throw new Error('Database schema is newer than this release; restore the matching release.');
  const pending = migrations.filter(m => m.version > current);
  if (current && pending.length && existsSync(file)) {
    mkdirSync(backupDir, { recursive: true, mode: 0o700 });
    const snapshot = join(backupDir, `${basename(file)}-before-v${latest}-${randomUUID()}.db`);
    db.prepare('VACUUM INTO ?').run(snapshot);
  }
  for (const step of pending) {
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(step.sql);
      db.prepare('INSERT INTO schema_migrations VALUES(?,?)').run(step.version, new Date().toISOString());
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  return latest;
}
