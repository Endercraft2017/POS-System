# Café POS project checklist

Updated November 2, 2026 (Philippine time). Checked means the named deliverable exists; it does not mean café-owner validation or production readiness. Prices are deferred.

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

- [ ] Create the multi-business backend and persistent database.
- [ ] Implement authentication, business/branch permissions and entitlement checks.
- [ ] Design offline operation IDs, durable queue, deduplication and recovery alongside cloud transactions.
- [ ] Implement audited order/payment/refund/stock operations and historical snapshots.
- [ ] Implement core menu, recipes, inventory, purchases/expenses, customer records and staff tasks.
- [ ] Implement basic reports and record exports.
- [ ] Test business isolation, backups/restoration and failure recovery.

## 4. Paid modules and integration

- [ ] Implement and validate one prepared offline register per branch.
- [ ] Build template website publishing and guest ordering against shared catalogue/branch data.
- [ ] Implement the bounded paid analytics.
- [ ] Build saved FAQ and included metered RAG with tenant isolation and handoff.
- [ ] Implement the 14-day trial and safe entitlement changes.
- [ ] Confirm gateway/merchant setup and payment/refund reconciliation.
- [ ] Prepare and submit Meta review when the required app/demo is ready; Messenger remains WIP.

## 5. Prelaunch and pilot

- [ ] Choose a working product name and create the early-access page/form.
- [ ] Test signup, contact permission and source tracking.
- [ ] Prepare focused posts/video concepts based on the confirmed offer and labeled prototype.
- [ ] Publish only when separately instructed.
- [ ] Recruit café-owner reviewers and 3–5 interested pilot cafés.
- [ ] Complete live-use invoicing, reliability and privacy requirements.
- [ ] Run a limited operational pilot and measure repeat use, friction and upgrade interest.

## Verification log

- `npm test`: 14 transaction-rule tests pass.
- `npm run check`: JavaScript syntax checks pass.
- Chrome desktop: menu search, sizes/add-ons, insufficient cash, cash checkout/change, preparation/ready/collection, refund and daily summary, pending GCash then simulated confirmation, reload persistence and demo reset verified.
- Narrow layout: reviewed using a 390px-wide browser iframe (375px content area with scrollbar); no horizontal overflow. Product dialog, Tab/Escape focus return, and mobile View order shortcut checked. This is not physical-device or production offline testing.
- Browser review found an HTTP-preview UUID compatibility issue and cramped add-on labels; both corrected.
- Storage failure/cross-tab UX is guarded in code, but browser storage exhaustion and concurrency stress tests have not been performed.
- Sample data only. Production authorization, payments, invoices, AI, cloud sync and backups remain unimplemented. No owner interviews, real payments, cloud deployment or production pilot have occurred in this change.
