# Architecture and implementation boundaries

Relax now has a Node.js 24 backend, a platform SQLite database, and an isolated SQLite database per tenant on persistent Railway storage. The counter remains a browser-only demo; tenant profiles/catalogues are server records. Operational transactions below remain a design contract until the counter is connected.

## Implemented tenant foundation

The public product site is `/`, published café pages are `/{slug}`, the operator console is `/_console`, and the café owner setup workspace is `/{slug}/_app`. The counter stays at `/_demo/`. Slugs resolve through the platform catalogue; database filenames use generated IDs. There is no default tenant or header-selected tenant.

Operator and owner accounts/sessions are separate. Session tokens are hashed, cookies are HttpOnly and Secure in production, and mutations require an allowed origin and session CSRF token. Passwords use scrypt. Suspension blocks tenant APIs/public publishing and revokes tenant sessions. Tenant text is escaped; no custom HTML or scripts are rendered.

Each tenant starts with one location, owner and membership. Additional locations require explicit grants, with the same owner assigned across locations. Employee invitations, roles beyond owner and seat billing remain to build. Free limits and paid publishing are server enforced. Paid allowances are development grants, not finalized packages.

Versioned migrations run transactionally before readiness, with pre-upgrade snapshots. Missing tenant files and newer schemas fail closed. See [Deployment](DEPLOYMENT.md) for paths and recovery. The implementation adapts the reviewed OTOM platform/tenant split to path-based Relax routing with original code.

## Foundation for the new service

| Concept | Required boundary |
| --- | --- |
| Business | Owns subscription, catalogue, knowledge and customer records; isolate unrelated cafés |
| Location | Owns orders, stock movements, tasks, expenses, hours and availability |
| User and membership | Authenticate one identity; authorize business membership, role and permitted branches |
| Seat | Count a staff member once per business, regardless of branch count |
| Entitlement | Server-enforced capabilities/allowances; separate configurable prices from authorization code |
| Order and lines | Immutable original pricing/recipe snapshots; explicit channel, branch, staff and operation ID |
| Payment/refund event | Append financial events with independent timestamps and reconciliation state |
| Stock movement | Append quantity changes with branch/item/unit/reason and source operation |
| Offline operation | Durable local queue with device/branch ownership; server deduplication and conflict/recovery rules |
| Website | Structured configuration and publish version referencing the shared catalogue |
| Assistant | Café/branch-filtered knowledge, current product reads, usage reservations and fallback |

Use transactional server operations for checkout and related side effects. Never rely on a browser-supplied tenant ID, hidden UI, shared token or raw SQL bridge as authorization. Verify backup restoration and exports before a live pilot.

## Separate lifecycles

Payment: pending, paid, refunded (prototype full refund only). Fulfillment: queued, preparing, ready, completed, cancelled. Production may require additional states once gateway and refund behavior are specified. Do not turn every state combination into an allowed action.

Prototype rules:
- A checkout request ID deduplicates an identical attempt and rejects a different payload using the same ID.
- Pending payment cannot enter preparation in the proposed pay-first flow.
- Starting preparation consumes the frozen recipe exactly once. Repeating an action has no additional effect.
- Cancelling an unpaid, unprepared order has no money/stock effect.
- Full refund records one refund event. Consumed ingredients are not automatically restored; unfulfilled refunded orders stop further fulfillment.
- Daily payment and refund totals use event dates in Asia/Manila; fulfilled order count is a separate measure.

The preparation-time deduction rule is proposed for review, superseding the earlier imprecise “on completion” wording only in the prototype. Production timing remains a decision to confirm.

## Implementation sequence

1. Workflow/specification and prototype delivered; café-owner review pending.
2. Business, operator/owner identity, branches, memberships, setup audit and entitlements delivered. Next: staff roles, audited transactions, offline operation IDs and sync contract.
3. Operational counter, menu, basic stock/recipes, records, simple reports/tasks and controlled corrections.
4. Paid offline register, recovery/sync reliability and the chosen live invoicing/payment arrangements; then limited live pilot.
5. Paid website and guest ordering, bounded analytics and included metered assistant. Start Meta review preparation as soon as its required working demonstration exists.
6. Entitlement changes, trial/subscription UX and rollout readiness. Numeric pricing is deferred, not hard-coded into modules.

The order within later milestones may change after owner validation. Confirmed paid capabilities remain in the plan; first coding milestones are not a revised free/paid promise.

## Prototype limitations

LocalStorage is used for convenient sample persistence, not security, multi-user consistency, production offline durability or cloud backups. Use one tab; cross-tab storage events trigger a warning/reload. It does not implement crash-safe distributed transactions. No service worker, live payment gateway, AI calls, real receipts or customer communications exist. Railway hosts the website, tenant setup and separate demo.

The first hosted foundation uses Node.js and SQLite per business on one Railway instance, following the reviewed OTOM pattern. Scale-out design, connection limits, off-site backups and operational offline behavior remain to validate before a broader pilot.
