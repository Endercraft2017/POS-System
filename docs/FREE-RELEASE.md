# Relax free release

Direction confirmed by Kyle on November 2, 2026, Philippine time: finish the free tier first, use it to attract café users, and present paid capabilities as WIP inside the app. Paid modules are not dependencies for the free release. Prices remain deferred.

The free operational modules are implemented in release 0.3.0. The authenticated café workspace uses persistent tenant records; /_demo/ remains a separate sample demo. Release is a controlled free pilot, not a claim of fiscal accreditation or completed café-owner validation.

## Free feature list and current readiness

| Area | Free release target | Current state |
| --- | --- | --- |
| Hosted café workspace | Browser access, isolated business data, one location | Operator provisioning, owner workspace, password change and operator recovery implemented |
| Product catalogue | 20 active base products, categories, prices, availability, basic sizes/modifiers/add-ons | Editing, archive/restore, server limit and basic options implemented |
| Counter and sales tracker | Cart, orders, payment recording, cash change, history, cancellation and refund records | Persistent counter, payment verification, full refund/cancellation and retry receipts implemented |
| Basic inventory | Ingredients/base units, starting stock, receiving, consumption, waste/count adjustments, low-stock flags and movement history | Ingredient editor, opening/receiving/waste/count, low-stock flags and movements implemented |
| Recipes / BOM | Ingredient quantities for products, sizes and simple add-ons; retain the recipe used for each order | Product/size/add-on recipes, frozen sale snapshots and atomic preparation deduction implemented |
| Purchases | Received stock quantities/costs with optional supplier/reference | Implemented in the owner workspace |
| Expenses | Dated amount, category, payment method and note | Implemented in the owner workspace |
| Minimal reports | Daily sales/payment/refund summary, transaction history and basic export | Manila date ranges, payments/refunds/net sales/expenses/purchases and five CSV exports implemented |
| Customer records | Optional name/contact and purchase history; guest checkout remains available | Implemented in the owner workspace |
| E-receipt / transaction copy | Private digital customer copy/link with an accurate label and a defined invoicing workflow | Private rotating transaction-copy links implemented; tax invoicing remains an external live-use gate |
| Notes / tasks | Instructions, due date/time, assignee/team where accounts are available, completion history | Implemented in the owner workspace |

These are the existing proposed free core, now grouped as the free delivery target. Previously explicit decisions remain: one location, 20 active base products, basic modifiers included, basic inventory/recipes free and minimal free reports. The included employee-account allowance is still open; the current foundation creates one owner. Do not advertise additional free staff seats or shared credentials.

An ingredient, an archived item or a basic product option does not consume another active base-product slot. A separately sold base item does. Do not add paid gates to basic sizes or modifiers.

The first payment workflow records cash and independently verified payments through the café’s existing channels. GCash, Maya, bank and card automation remain separate integration work. A screenshot or payment redirect alone does not confirm payment. The free counter requires a connection for finalizing new sales and must preserve entered work and resolve uncertain results after interruption.

## Paid roadmap: WIP after the free release

| Planned capability | Boundary |
| --- | --- |
| Café website and online store | Business details, predefined themes/layouts, promotions and structured online orders; existing fixed-menu publishing is only a development preview |
| Offline counter | One prepared register per branch, durable records and safe reconnect synchronization |
| Full analytics | Trends, comparisons, product performance, peak hours and bounded margin/branch analysis |
| Customer RAG assistant | Included in a monthly paid subscription with usage limits and staff fallback |
| Additional locations and employee accounts | Monthly extensions; one employee counts once per business across assigned branches |
| Larger catalogue | Allowance and price still open; no advertised numerical paid cap |
| 14-day paid trial | Introduce only when the included paid capabilities are usable; do not consume a trial while they are WIP |

Facebook/Messenger remains WIP pending implementation and Meta review, with final plan allocation open. A basic saved-answer FAQ is proposed for the later website; it is not a promised free public chatbot. Loyalty cards, branch chat, bulk email/SMS and an owner-facing AI helper remain backlog, not extra free-release requirements. A shareable customer copy is separate from automated email delivery, which remains follow-up work.

## Implementation order

1. Completed: operator-assisted onboarding, catalogue editing, sizes and basic modifiers.
2. Completed: authenticated branch-scoped orders, payment/refund events, audit and durable operation IDs. Prices/options/recipes are frozen per order. Initial pilot rules: payment before preparation; ingredient deduction at preparation; no automatic stock restoration on refund. Validate these defaults with pilot cafés.
3. Completed: recipes, ingredients, stock movements, purchases and expenses.
4. Completed: reports/export, optional customer history, private transaction copies and tasks.
5. Verify the whole free workflow, account recovery, backup restoration, supported devices and the chosen live invoicing/privacy/payment-recording arrangements. Run a small free pilot, then open broader free onboarding.
6. Build paid capabilities one at a time using pilot feedback. Existing tenant, branch and entitlement boundaries stay in place; paid UI and offline sync do not delay the free pilot.

## Definition of a usable free release

- A new café can onboard, configure a menu/recipes and starting stock, and complete a sale without developer database edits.
- Orders, payment/refund events and ingredient movements survive reload/restart and remain isolated to the café and authorized branch.
- Repeated or interrupted submissions cannot double-charge the recorded sale or deduct stock twice; pending payments stay pending until independently verified.
- Cancellation/refund behavior is auditable; prepared ingredients are not silently restored to inventory.
- Receiving, waste/count corrections, purchases, expenses, customer history, tasks, daily totals and exports work with real tenant data.
- Digital copies expose only the intended transaction and have accurate document labels. Required live-use rules are documented and implemented.
- Free limits are enforced by the server, backup recovery is demonstrated, and owner sign-in/recovery and connection-loss paths are verified.
- Paid features are clearly WIP. No paid checkout or trial timer activates unfinished features.

## Marketing and WIP presentation

Before readiness: promote the free entry offer as being built, show the labeled interactive demo, and invite café owners into early access once signup/consent handling is ready. After the free pilot passes: promote the features verified in that release and direct people to working onboarding. Do not call the current demo an operational free POS.

Inside the app, use one collapsible **Coming next** panel with a benefit and **Planned paid feature · WIP** label for each teaser. The product site can show the same roadmap. No dead-end upgrade buttons, paid checkout, automatic trials or invented release dates. Users should reach working free tools first.

Marketing success measures: qualified café signups, completed setup, first recorded sale and repeat use. Paid interest is useful feedback, not evidence that a paid feature exists. Social publishing remains separately instructed.

## Release verification and remaining operational gates

26 automated checks pass, including encrypted snapshot/restore, corrupted-copy rejection, session invalidation, payment/refund day boundaries, cross-branch access and retry deduplication. Desktop browser checks covered real backend checkout/change, preparation/stock, receiving/purchase, product editing, tasks, reports and a private transaction copy using disposable records. The responsive counter fits a 375px content viewport without document overflow. Operator controls were reviewed; provisioning/recovery are integration-tested. Physical device, prolonged outage and multi-register load testing remain pilot work.

Scheduled encrypted snapshots run at startup and every 24 hours, retaining seven copies. The operator can download a recovery bundle; an off-volume copy and a Railway restore drill still need to be established. Local backup is not disaster recovery. See DEPLOYMENT.md.

Free access is operator-provisioned through the console; the public page has an email access-request link. No public registration/consent campaign, real café pilot or actual payment/invoice has been performed by these tests. One owner login is the pilot default, not a newly finalized staff-seat allowance. Tax treatment, required discounts/invoicing and customer-data operating arrangements must be resolved with each pilot before live trading. No statutory-discount automation is implemented.

## Shared agent office

The existing AFK³ agent system hosts separate Relax outreach research, marketing draft and email draft roles. A scoped server credential exposes aggregate tenant status/counts only. All workers can use the same bounded status summary; no customer contacts, transactions, admin passwords or console sessions are shared. Handoffs reuse the existing reviewed ledger. Paid features stay WIP in agent claims. Sending/publishing are separate owner actions, not enabled by creating these workers.
