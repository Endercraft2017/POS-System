# Relax on Railway

## Existing project

- [Railway project](https://railway.com/project/58a67b7f-9459-4edc-8b29-b43beb24c8db): `58a67b7f-9459-4edc-8b29-b43beb24c8db`
- Service: `POS-System` (`cc73bb69-f3e2-4774-b62b-54cf4b2b6f52`)
- Environment: `production` (`84cdd7fa-3a42-49ce-b310-07351eb3c805`)
- Volume: `relax-data`, mounted at `/data`.
- Source: `Endercraft2017/POS-System`, `main` after the foundation PR is merged.
- One instance. Do not scale this SQLite deployment to multiple replicas or attach an empty replacement volume.

The original failure was a build failure: Railway watched `main`, which contained only `README.md`. The application was on the PR branch. Railpack could not identify an app to build.

## Runtime and operator access

| Variable | Value/purpose |
| --- | --- |
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `TZ` | `Asia/Manila` |
| `DATA_DIR` | `/data` |
| `PUBLIC_ORIGIN` | `https://relax.afkcube.com` |
| `CONSOLE_USERNAME` | `owner` |
| `CONSOLE_PASSWORD` | Generated unique secret stored in Railway service variables |

Retrieve the operator password in Railway → POS-System → Variables. It is not in Git, logs, this document or a default login. Sign in at `/_console`. Changing the password variable and redeploying rotates the operator password and revokes existing console sessions. Keep the existing username after initial setup. Tenant credentials are separate and cannot access the console.

## Custom domain

`relax.afkcube.com` is attached to the service on port 3000. Railway returned:

| Type | Host/name under `afkcube.com` | Value |
| --- | --- | --- |
| CNAME | `relax` | `awycpwob.up.railway.app` |
| TXT | `_railway-verify.relax` | `railway-verify=b0208cf3b4e93215e2cbea230d7b18b934d0fd4aa36372a0e0e76c26a7201625` |

At setup time the CNAME was unset and Railway was validating ownership. The TXT is a public ownership record. These records must be added at the authoritative DNS provider; Railway attachment does not add DNS. Leave unrelated domain records unchanged. Verify ownership and certificate issuance in Railway afterward. No wildcard is needed: café tenancy uses paths.

## Café provisioning

1. At `/_console`, create a business with its slug and owner credentials. New businesses start empty on the free entitlement with one location.
2. The owner signs in at `/{slug}/_app`, adds menu items and saves café information.
3. An operator can grant paid access and explicit product/location allowances, then enable website publishing. During development this is not billing or payment collection.
4. `/{slug}` is public only while active, published and entitled to the website. It displays a menu; automated online checkout is not implemented.
5. Suspension revokes café sessions and blocks both owner APIs and the public page. No data is deleted. Reactivation requires a new login.

## Migrations and storage

- `/data/platform.db`: tenant catalogue, operator identity/sessions and audit.
- `/data/tenants/{business-id}.db`: profile, products, locations, users, memberships, tenant sessions and audit.
- `/data/backups/migrations/`: pre-upgrade SQLite snapshots.
- Each database tracks `schema_migrations`. Each step is transactional. Startup migrates active/suspended tenants before listening; a failure prevents readiness. An old release refuses a newer schema.
- Missing tenant files fail closed. Provisioning failures retain their catalogue entry and any files for operator recovery.
- Snapshots on the same volume are not disaster recovery. An off-site backup schedule and Railway restore drill remain launch requirements.

## Backup and recovery

Run `npm run backup` in the service environment to create standalone SQLite snapshots including committed WAL data. For a consistent recovery set across databases, stop writes first; the manual script does not create a distributed snapshot of concurrent provisioning. Copy the full snapshot directory to approved private off-site storage.

To restore: stop the app, preserve the current volume contents, restore matching platform and tenant snapshots as a set, and preserve/remove obsolete WAL/SHM companions before startup. Start the matching app version, check health and tenant data, then reopen writes. Never overwrite a live SQLite file. Local tests confirm migration snapshots retain data and failing migrations roll back; a Railway disaster-recovery drill remains pending.

## Release verification and limitations

`npm run check` and `npm test` must pass. Railway must reach `SUCCESS` and `/api/health` must return `ok: true`. Check `/`, `/_demo/`, `/_console` and an approved café flow; keep test businesses out of production. Domain DNS/certificate readiness is separate from deployment health.

Operational sales still run only in the browser-local demo. Tenant counter transactions, staff management, sizes/recipes, receipts, payments, trial/billing, AI, online orders, selectable website themes, automatic off-site backups and paid offline sync remain incomplete. Prices and paid package limits are deferred.
