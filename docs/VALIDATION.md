# Validation plan

## Owner review (not yet conducted)

Recruit 3–5 café owners for an initial qualitative review. Ask them to perform tasks without a guided click-by-click tour. Capture task success, hesitation, missing information and current real-world practice; do not treat a small review as market proof.

1. Sell a large latte with an extra shot for cash and find the change amount.
2. Find the size/add-on/note in the preparation queue and complete the order.
3. Record an electronic payment still waiting for confirmation; identify what staff must check.
4. Cancel an unpaid order. Refund a prepared order. Explain the stock outcome.
5. Find today's cash/electronic receipts, refunds and ingredient movements.
6. Describe what should happen if the connection drops mid-checkout.

Questions to resolve: when ingredients are consumed, whether payment normally precedes preparation, handling waste/refunds, shared devices, pickup acceptance, branch permissions and invoice workflow. Keep new feature requests in a backlog with a recurring problem and tradeoff.

## Automated checks

Run `npm test` for meaningful transaction rules and `npm run check` for JavaScript syntax. Tests should cover invalid quantities/options, cent-accurate money/change, pending payment, duplicate requests/actions, recipe snapshots, insufficient stock, cancellation/refund effects and Asia/Manila event dates.

## Browser checks

Review desktop and narrow viewport; keyboard navigation and modal focus/Escape; searchable/filterable menu; cart updates; insufficient cash; successful checkout; pending electronic confirmation; preparation/completion; refund stock outcome; summary and local reload; reset behavior. Inspect actual content for clipping and inaccessible controls. Record checks actually performed in the checklist.

## Live pilot gates (future)

- Validated invoicing, tax and discount specification.
- Approved merchant channels and independently verified payment events.
- Tenant isolation and authorized branch access tested with unrelated businesses.
- Reliable duplicate handling, stock audit trail and historical recipe/price snapshots.
- Supported offline devices/storage, retry/recovery, entitlement expiry and website outage behavior tested.
- Export, backup restoration, privacy/retention and support workflow ready.
- Explicit list of available free/paid features; no claim that WIP Messenger or future modules are available.
