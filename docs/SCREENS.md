# Screen map

Proposed screen boundaries, not a promise that every screen is built. Café branding should feel warm and calm; counter controls must remain readable, quick and touch-friendly.

| Screen | Primary action | Journey | Prototype |
| --- | --- | --- | --- |
| Setup | Create café/first branch and establish sale readiness | W01 | Spec only |
| Counter | Search menu, configure products and manage cart | W02 | Interactive |
| Checkout | Record sample cash or pending electronic payment | W02 | Interactive |
| Order list/detail | Confirm sample payment, prepare, complete, cancel/refund | W02 | Interactive |
| Menu editor | Manage categories, active products, sizes and modifiers | W01 | Spec only; seeded menu in prototype |
| Inventory | View ingredient balances and consumption history | W03 | Read-only balances and demo movements |
| Recipes / receiving / adjustments | Maintain recipes and stock movements | W01/W03 | Spec only |
| Expenses | Record a dated business expense | W03 | Spec only |
| Daily summary | Review daily paid/refunded totals and payment methods | W03 | Interactive sample calculations |
| Paid analytics | Trends, product performance, peak hours, ingredient margins, branch comparison | W03 | Spec only |
| Tasks | Assign work and record completion | W07 | Spec only |
| Customers | Optional contact and purchase history | W02 | Spec only |
| Business / branches / staff | Settings, role permissions and branch memberships | W01/W07 | Spec only |
| Website editor | Populate fixed sections, pick theme/layout, preview/publish | W04 | Spec only |
| Public café site / menu / checkout / status | Guest pickup ordering | W04 | Spec only |
| Assistant settings / conversations | Approved knowledge, usage and handoff | W06 | Spec only |
| Plan and trial | Entitlements, trial status and monthly usage | W08 | Spec only |
| Sync and recovery | Queue, last sync, conflicts and export/recovery | W05 | Spec only |

## Paid WIP presentation

The free release is the first delivery milestone. Show paid website/online orders, offline counter, analytics and the customer assistant in one collapsible **Coming next** panel in the café workspace. Each preview describes the benefit and says **Planned paid feature · WIP**. No activation, purchase, trial timer or implied release date. The public site uses the same copy. Keep unfinished paid tools out of the main working navigation.

## Shared UI rules

- Keep the active business/branch visible. A single sample branch is not the future data model.
- Separate payment and fulfillment badges; label pending clearly.
- Use Philippine peso formatting and Asia/Manila dates in the first market.
- Minimum touch targets around 44px, visible keyboard focus, descriptive accessible labels and working modal dismissal/focus.
- Use warm cream, espresso text and muted green as the initial direction, not a final brand identity.
- Show loading, empty, error, limit and disconnected states alongside successful states.
- Keep product limits, AI allowance and trial expiry understandable without internal implementation terms.
- Do not show a functional-looking action for an unimplemented module.

## First review script

Open Counter, find a latte, select a larger size and extra shot, check out with cash, prepare and complete it, then inspect Orders, Inventory and Daily summary. Repeat with pending electronic payment and a refund after preparation. Check phone-width and keyboard usability as well as desktop checkout.
