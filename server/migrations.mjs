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

tenantMigrations.push({ version: 2, sql: `
  ALTER TABLE products ADD COLUMN options_json TEXT NOT NULL DEFAULT '{"sizes":[],"addons":[],"modifiers":[],"trackStock":false}';
  ALTER TABLE products ADD COLUMN recipe_json TEXT NOT NULL DEFAULT '[]';
  CREATE TABLE operations (id TEXT PRIMARY KEY, actor TEXT NOT NULL, kind TEXT NOT NULL, fingerprint TEXT NOT NULL, response TEXT NOT NULL, at TEXT NOT NULL) STRICT;
  CREATE TABLE ingredients (id TEXT PRIMARY KEY, name TEXT NOT NULL, unit TEXT NOT NULL CHECK(unit IN ('g','mL','pc')), low_milli INTEGER NOT NULL CHECK(low_milli>=0), unit_cost INTEGER NOT NULL CHECK(unit_cost>=0), created_at TEXT NOT NULL) STRICT;
  CREATE TABLE stock (branch_id TEXT NOT NULL REFERENCES branches(id), ingredient_id TEXT NOT NULL REFERENCES ingredients(id), quantity_milli INTEGER NOT NULL CHECK(quantity_milli>=0), PRIMARY KEY(branch_id,ingredient_id)) STRICT;
  CREATE TABLE stock_movements (id TEXT PRIMARY KEY, branch_id TEXT NOT NULL REFERENCES branches(id), ingredient_id TEXT NOT NULL REFERENCES ingredients(id), delta_milli INTEGER NOT NULL, kind TEXT NOT NULL, reason TEXT NOT NULL, source_id TEXT NOT NULL, actor TEXT NOT NULL, at TEXT NOT NULL) STRICT;
  CREATE INDEX movements_branch_date ON stock_movements(branch_id,at);
  CREATE TABLE customers (id TEXT PRIMARY KEY, name TEXT NOT NULL, contact TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL) STRICT;
  CREATE TABLE orders (id TEXT PRIMARY KEY, number INTEGER NOT NULL UNIQUE, branch_id TEXT NOT NULL REFERENCES branches(id), actor TEXT NOT NULL, customer_id TEXT REFERENCES customers(id), customer_name TEXT NOT NULL DEFAULT '', snapshot TEXT NOT NULL, total INTEGER NOT NULL CHECK(total>=0), method TEXT NOT NULL CHECK(method IN ('cash','gcash','maya','bank','card')), cash_tendered INTEGER NOT NULL CHECK(cash_tendered>=0), payment_status TEXT NOT NULL CHECK(payment_status IN ('pending','paid','refunded')), status TEXT NOT NULL CHECK(status IN ('queued','preparing','ready','completed','cancelled')), note TEXT NOT NULL DEFAULT '', receipt_hash TEXT UNIQUE, created_at TEXT NOT NULL, updated_at TEXT NOT NULL) STRICT;
  CREATE INDEX orders_branch_date ON orders(branch_id,created_at);
  CREATE TABLE payment_events (id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id), branch_id TEXT NOT NULL REFERENCES branches(id), kind TEXT NOT NULL CHECK(kind IN ('payment','refund')), amount INTEGER NOT NULL CHECK(amount>=0), method TEXT NOT NULL, reference TEXT NOT NULL DEFAULT '', reason TEXT NOT NULL DEFAULT '', actor TEXT NOT NULL, at TEXT NOT NULL, UNIQUE(order_id,kind)) STRICT;
  CREATE INDEX payments_branch_date ON payment_events(branch_id,at);
  CREATE TABLE purchases (id TEXT PRIMARY KEY, branch_id TEXT NOT NULL REFERENCES branches(id), ingredient_id TEXT NOT NULL REFERENCES ingredients(id), quantity_milli INTEGER NOT NULL CHECK(quantity_milli>0), total_cost INTEGER NOT NULL CHECK(total_cost>=0), supplier TEXT NOT NULL DEFAULT '', reference TEXT NOT NULL DEFAULT '', actor TEXT NOT NULL, at TEXT NOT NULL) STRICT;
  CREATE TABLE expenses (id TEXT PRIMARY KEY, branch_id TEXT NOT NULL REFERENCES branches(id), amount INTEGER NOT NULL CHECK(amount>0), category TEXT NOT NULL, method TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', business_date TEXT NOT NULL, void_reason TEXT, actor TEXT NOT NULL, at TEXT NOT NULL) STRICT;
  CREATE TABLE tasks (id TEXT PRIMARY KEY, branch_id TEXT NOT NULL REFERENCES branches(id), title TEXT NOT NULL, instructions TEXT NOT NULL DEFAULT '', assignee TEXT NOT NULL DEFAULT '', due_at TEXT, status TEXT NOT NULL CHECK(status IN ('open','done')), completed_at TEXT, actor TEXT NOT NULL, created_at TEXT NOT NULL) STRICT;
` });

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
