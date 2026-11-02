# Workflow blueprint

Status: proposed behavior for review, November 2, 2026. Product allocations follow [PRODUCT-SCOPE.md](PRODUCT-SCOPE.md). The counter workflow has an interactive prototype; other journeys below are specifications only.

## Roles and access

| Role | Intended access |
| --- | --- |
| Owner | Business settings, subscription, authorized branches and staff access |
| Manager | Assigned branches, menu/stock/tasks/reports, permitted corrections |
| Cashier/staff | Assigned branch, counter sales, fulfillment and allowed tasks |
| Guest customer | Public menu, submitted order status and private transaction link |

Exact permission presets remain open. Refund, price override, exports and staff changes must be separately controlled. Never infer permission from a hidden button alone.

## W01: Owner setup and first sale readiness

**Start:** a new business owner registers online. **Finish:** the first branch has a usable menu and can take a correctly recorded sale.

1. Create the business and first branch; set Philippine timezone, branch contact and hours.
2. Add menu categories, base products, prices, sizes and simple add-ons. Show active-product usage against the free allowance.
3. Add ingredients in base units (g, mL, pieces), starting stock and simple recipes per size/add-on.
4. Set up the chosen invoicing workflow and record which payment methods the café actually accepts.
5. Invite permitted staff if entitled; assign branch membership and roles.
6. Run a clearly marked training order before entering live mode.

**Exceptions:** duplicate business setup, interrupted form, invalid quantities and over-limit products must preserve entered work and show a specific correction. Missing recipes must be visible; they must not masquerade as fully tracked stock. Whether recipes are mandatory for a sellable product is an open decision.

## W02: Counter order, payment and fulfillment

**Start:** authorized staff choose their active branch. **Finish:** a traceable paid/fulfilled order and its stock movements appear in the daily records.

1. Find products by category or search; choose size, add-ons and quantity; add an optional preparation note.
2. Review the cart, item prices and total. Apply only permitted and specified discounts/tax rules in the future production service.
3. Choose cash or an accepted electronic method. For cash, require received amount at least equal to the total and show change.
4. Save the order once. Cash can be recorded as paid; an electronic payment awaiting independent confirmation stays pending.
5. Provide the appropriate customer document/status access. A submitted order or payment screenshot alone is not confirmation.
6. For the proposed pay-first flow, begin preparation only after payment is confirmed. Staff see size, modifiers and notes.
7. Mark ready, then collected/completed. Fulfillment is distinct from payment status.
8. The daily summary reflects payment/refund events, and stock records reflect actual consumption.

**Prototype proposal requiring review:** deduct recipe ingredients when preparation starts, once per order. This is more explicit than the earlier ambiguous term “on completion.” The prototype retains the recipe/price snapshot from the order. Confirm this timing with café owners before backend implementation.

### Essential exceptions

| Event | Proposed behavior |
| --- | --- |
| Cart changes before checkout | Recalculate; preserve selected options and notes |
| Repeated checkout click | Same checkout attempt produces one order |
| Pending/failed electronic payment | Keep pending; never report it paid merely from redirect, screenshot or order submission |
| Cancel before payment/preparation | Cancel without a sale, refund or stock consumption |
| Cancel a paid, unprepared order | Use a financial refund, retaining the audit trail |
| Refund a prepared drink | Record refund; do not automatically return consumed milk/coffee to stock |
| Recoverable physical stock | Separate controlled adjustment with reason; outside prototype |
| Insufficient stock | Prototype blocks preparation and shows the ingredient shortage; production override policy remains open |
| Correct an already paid order | Explicit audited correction/refund path; no silent rewriting of historical prices/recipes |
| Connection lost on free plan | Preserve entered work, resolve any uncertain checkout result, require connection for new final sales |
| Save fails in prototype | Keep the cart/dialog; show failure; do not show a successful checkout |

The prototype offers full refunds only. Production partial refunds and method-specific reconciliation need a later specification. A simulated refund does not move money.

## W03: Receive stock, record expenses and close the day

**Start:** manager has branch access. **Finish:** movements and the day's totals can be explained.

1. Record received ingredient quantities/costs and an optional supplier/reference.
2. Record waste or count correction with a reason, preserving movement history.
3. Record simple expenses with date/category/method/note.
4. Review today's payments, refunds, orders, stock movements and overdue staff tasks.
5. Compare recorded cash with counted cash; flag differences for investigation. Exact cash-shift workflow is open.
6. Export basic records; paid users can open the bounded deeper analytics.

Use Asia/Manila business dates. A refund today for yesterday's sale belongs to today's refund events, without erasing yesterday's sale. Sales less refunds is not net profit. Expenses/ingredient cost are separate.

## W04: Customer website order

**Start:** customer visits a published paid café website. **Finish:** the chosen branch accepts and fulfills a traceable order.

1. Owner provides business details/photos/hours; chooses a theme/layout; previews then publishes.
2. Guest selects a branch, browses the shared menu and adds sizes/modifiers to a cart.
3. Validate branch hours, item availability and authoritative prices when submitting.
4. Collect only the contact/pickup details needed; marketing consent is separate.
5. Show pending acceptance/payment as appropriate. Staff accept or reject explicitly.
6. Route payment confirmation and fulfillment through the same lifecycle as counter orders.
7. Guest checks private order status and receives pickup instructions.

**Exceptions:** sold-out item, closed/unreachable branch, price change, duplicate submission, rejected prepaid order and abandoned checkout need explicit user-visible outcomes. Do not promise fulfillment before branch acceptance. Pickup first and gateway timing are still proposals.

## W05: Paid offline register

**Start:** one authorized device for a branch has completed online setup, authorization and data download.

1. Show offline state, last successful sync and queued transaction count.
2. Use the saved menu/price/recipe version and durably record cash transactions locally before showing success.
3. Preserve original time, staff, branch, prices, recipe quantities and unique operation IDs.
4. Retry upload when the device reconnects or the app reopens; server deduplicates sales/payments/stock effects.
5. Surface conflicts and refresh future menu data without rewriting completed offline sales.
6. Allow existing queued records to sync/export even if a subscription changes.

Cloud assistant, live cross-branch data and new website-order delivery to the disconnected register require connectivity. Proposed website behavior: pause new branch checkout after a defined disconnect timeout, while preserving existing orders. Device/browser support, timeout, offline duration, grace/revocation policy and recovery are unresolved. Browser localStorage in this prototype is not this design.

## W06: Customer assistant

**Start:** visitor asks a question in the paid website. **Finish:** a supported answer, ordering link or staff handoff.

1. Establish the café and selected branch; use only that business's approved knowledge.
2. Read live prices/availability through catalogue data, not an old uploaded menu.
3. Serve saved FAQ answers without a model where appropriate.
4. For generated answers, check entitlement and remaining usage, reserve usage, answer from approved sources and reconcile metering.
5. On insufficient knowledge, provider failure or quota exhaustion, show saved answers/staff contact; do not invent an answer or create automatic charges.

No autonomous stock/price/refund edits. The owner-facing AI helper is separate and deferred. Numerical limits and exact billing-month accounting remain open.

## W07: Staff tasks and branch switching

Manager creates a task with branch, instructions, assignee/team and due date/time. Assigned staff see today's/overdue tasks and mark completion with history. One employee can switch between authorized branches without consuming another seat; branch selection is visible before writes. Task collaboration while offline, recurring templates and branch chat are deferred.

## W08: Trial, upgrade and downgrade

Show the 14-day trial's start/end and available paid features. Activation, card requirement and trial quotas are open. At expiry, preserve records/settings; offer a chosen free branch/allowed seats/products, keep excess products inactive for new sales, and protect existing website fulfillment and unsynced offline transactions. Entitlement policy and grace are specified before implementing subscription changes. Monthly billing and included limited AI remain confirmed; prices are deferred.
