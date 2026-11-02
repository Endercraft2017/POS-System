# Café POS project checklist

Updated November 2, 2026 (Philippine time). Checked means the named deliverable exists; it does not mean café-owner validation or production readiness. Prices are deferred.

## Current priority: finish the free tier

Kyle confirmed free-first delivery on November 2, 2026. See [Free release scope and readiness](FREE-RELEASE.md). Paid features stay in the roadmap as WIP and do not block the free pilot. The free operational implementation is complete for controlled pilot evaluation; live-use gates below remain explicit.

- [x] Record the free-first release decision and retain the full planned feature list.
- [x] Show clear paid-feature WIP previews on the product site and café workspace, without activation, payment or trial controls.
- [x] Finish free onboarding, catalogue editing, sizes and basic modifiers.
- [x] Connect real tenant orders/payments/refunds and retain audit/history with retry-safe operations.
- [x] Complete free recipes, ingredient stock, receiving/adjustments, purchases and expenses.
- [x] Complete minimal reports/export, customer history, digital transaction copies and simple tasks.
- [ ] Verify free release readiness, including recovery/backups and live-use requirements, then run a small free pilot.
- [ ] Open broader free onboarding and market only the verified available features; use demo/early-access messaging before that point.

## 1. Scope and workflow

- [x] Record the café niche and hosted service direction.
- [x] Record the free 20-product allowance, basic modifiers, inventory/recipes and minimal reports.
- [x] Record monthly paid subscription with limited AI, paid website/offline/analytics and extra branches/accounts.
- [x] Record one staff account across assigned branches and the 14-day trial.
- [x] Draft owner, cashier, daily review, website customer, offline, assistant, task and trial journeys.
- [x] Draft payment/fulfillment exceptions and a screen map.
- [x] Sequence implementation milestones and architecture boundaries.
- [ ] Confirm preparation-time stock consumption and the pay-first counter flow with café owners.
- [ ] Resolve included accounts, paid catalogue cap, pickup flow, trial rules and exact permissions.
- [ ] Specify supported devices, offline recovery/grace and branch website outage behavior.
- [ ] Specify tax/discount/invoicing and payment reconciliation for live use.
- [ ] Resume operating-cost/pricing/AI quota work when requested; before selling paid subscriptions.

## 2. Interactive prototype

- [x] Build counter, checkout, orders, stock and daily-summary prototype.
- [x] Verify domain rules: totals/change, duplicate attempts, payment states, stock consumption, refunds and business dates.
- [x] Review desktop/mobile layout and keyboard flow in a browser.
- [x] Record verification evidence and remaining limitations.
- [ ] Observe 3–5 café owners using the prototype; capture friction and revise.

## 3. Production foundation

- [x] Create the platform catalogue and separate persistent tenant databases with migrations.
- [x] Add operator/owner authentication, branch memberships and setup entitlements.
- [x] Build operator tenant provisioning, monitoring, publishing and suspension.
- [x] Build owner profile/menu setup and location creation within granted allowances.
- [ ] Complete employee accounts, role/branch permissions and seat lifecycle across operational modules.
- [x] Design operation IDs, immutable snapshots and retry deduplication in free cloud transactions; defer the paid device queue and offline recovery implementation.
- [x] Implement audited order/payment/refund/stock operations and historical snapshots.
- [x] Implement core menu, recipes, inventory, purchases/expenses, customer records and staff tasks.
- [x] Implement basic reports and record exports.
- [x] Test business isolation, reopening persistence, entitlement limits and migration snapshot/rollback locally.
- [ ] Configure automatic off-site backups and complete Railway restore/failure-recovery drills.

## 4. Paid modules and integration — WIP after the free release

- [ ] Implement and validate one prepared offline register per branch.
- [x] Build a fixed-layout café menu page and paid publishing gate.
- [ ] Add selectable themes/layouts, promotions and guest ordering.
- [ ] Implement the bounded paid analytics.
- [ ] Build saved FAQ and included metered RAG with tenant isolation and handoff.
- [ ] Implement the 14-day trial and safe entitlement changes when paid capabilities are usable; do not start a trial for WIP features.
- [ ] Confirm gateway/merchant setup and payment/refund reconciliation.
- [ ] Prepare and submit Meta review when the required app/demo is ready; Messenger remains WIP.

## 5. Free prelaunch and pilot

- [x] Adopt Relax and build the green public product website with development/demo status.
- [ ] Add the early-access signup form and consent workflow.
- [ ] Test signup, contact permission and source tracking.
- [ ] Prepare focused posts/video concepts for the free offer: labeled demo/early access now, verified free capabilities after the pilot.
- [ ] Publish only when separately instructed.
- [ ] Recruit café-owner reviewers and 3–5 interested pilot cafés.
- [ ] Complete live-use invoicing, reliability and privacy requirements.
- [ ] Run a limited operational pilot and measure repeat use, friction and upgrade interest.

## 6. Railway deployment

- [x] Diagnose failure: Railway was building README-only `main`.
- [x] Configure production variables, protected console credentials, persistent `/data` volume and health check.
- [x] Attach `relax.afkcube.com` on port 3000.
- [x] Merge PR #1 to `main` and verify healthy Railway deployment `0484fcf9-5b34-4c0c-a343-62a8738c39e7` (commit `5576a4b`).
- [x] Verify the custom domain: Railway confirms DNS propagated, ownership verified and a valid TLS certificate; fresh HTTPS requests succeed.
- [x] Connect the counter to branch-scoped server transactions before live trading.

## Historical verification log (earlier foundation/demo releases)

- `npm test`: 19 checks pass (14 counter rules and 5 backend integration/storage/migration checks).
- `npm run check`: JavaScript syntax checks pass.
- Chrome desktop: menu search, sizes/add-ons, insufficient cash, cash checkout/change, preparation/ready/collection, refund and daily summary, pending GCash then simulated confirmation, reload persistence and demo reset verified.
- Narrow layout: reviewed using a 390px-wide browser iframe (375px content area with scrollbar); no horizontal overflow. Product dialog, Tab/Escape focus return, and mobile View order shortcut checked. This is not physical-device or production offline testing.
- Browser review found an HTTP-preview UUID compatibility issue and cramped add-on labels; both corrected.
- Storage failure/cross-tab UX is guarded in code, but browser storage exhaustion and concurrency stress tests have not been performed.
- The counter is sample-data only. The setup backend persists tenant profiles/catalogues and authenticates operator/owner access. Payments, invoices, AI, cloud transaction sync and automatic off-site backups remain unimplemented. No owner interviews, real payments or operational pilot have occurred.
- Browser: Relax landing, operator login and locally seeded café page reviewed at desktop and 390px iframe widths. No horizontal overflow. Operator/owner workflows passed API integration tests; a complete signed-in console browser walkthrough remains pending.

- Railway release verification: build ran all 19 tests and syntax checks; `/api/health` succeeded. One replica is running, zero crashed, volume mounted, and no pending work. DNS/HTTPS verified November 2, 2026: CNAME propagated, domain ownership verified, certificate VALID, homepage HTTP 200 and `/api/health` HTTP 200 with `ok: true`. No certificate-verification bypass was used.

- Free-first presentation update: existing 19 tests and syntax checks pass. Public roadmap reviewed on desktop; product roadmap and the shared workspace disclosure reviewed at 390px frame width (375px content), with no horizontal overflow. Disclosure opens/closes by keyboard. This was a component review, not a signed-in operational POS walkthrough. The free operational modules remain unchecked above.

## Free operational release 0.3.0 · November 2, 2026

- [x] 26 automated checks and syntax checks pass; private copies, monitor scoping, restore and retry behavior covered.
- [x] Desktop owner workflow and responsive 375px content layout reviewed with disposable café records.
- [x] Add encrypted startup/daily snapshots, seven-copy retention, console download and non-overwriting restore command.
- [x] Add operator owner-password reset and owner password change with session revocation.
- [x] Add scoped aggregate monitor endpoint and agent-office link; build three bounded Relax draft workers in the existing agent system.
- [x] Delegate café visuals: three stations, coffee queue, accessible roster and actual handoff journeys.
- [ ] Verify an off-volume backup and perform the Railway recovery drill.
- [ ] Complete café-specific invoicing/discount/privacy arrangements and supervised real-café pilot before broader marketing.

Earlier statements that the counter is only sample data are superseded by this release. The public /_demo/ remains sample-only. No paid subscription, campaign, real email or real café transaction was started.
