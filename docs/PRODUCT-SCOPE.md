# Product scope

Baseline: November 2, 2026, Philippine time. Distinguish confirmed requirements from implementation proposals. This document carries the planning baseline into the new repository; prices remain deferred at Kyle's request.

## Product and audience

- Hosted browser SaaS for small Philippine cafés, with a modern café visual style.
- One café business can have multiple branches from the initial data model. Every unrelated café's data must remain isolated.
- One employee account counts once within a business across its assigned branches. Branch access does not create extra seat charges.
- A free entry plan and a monthly paid subscription. The paid subscription includes the customer AI assistant with usage limits. Extra locations and employee accounts incur monthly charges.
- A 14-day trial of available paid capabilities. Exact quotas and expiry rules need agreement.

## Feature boundary

| Area | Confirmed direction | Detail still proposed/open |
| --- | --- | --- |
| Free location | One location | Included staff allowance; one owner is a proposal |
| Free catalogue | 20 active base products; basic sizes, modifiers and add-ons included | A standalone item counts; archived items and ingredients do not |
| Paid catalogue | Larger allowance | 500 is a proposal, not an approved cap |
| Stock and recipes | Basic ingredient inventory and recipes are free | Receiving, waste/count adjustment, low-stock flags, recipe quantities by size and add-on |
| Reporting | Minimal free reports, deeper paid analytics | Free daily totals/history/export; paid trends, product performance, peak hours, ingredient margins and branch comparison |
| Counter operations | Core POS, sales and payment recording | Free allocation proposed; discounts/tax rules require their own validated specification |
| Purchases and expenses | Simple records in scope | Free allocation proposed; no full accounting or payroll |
| Customer records and copies | Optional contact/history and electronic transaction copies | Free allocation proposed; confirm the applicable fiscal workflow before live use |
| Staff notes | Tasks with instructions, branch, assignee/team, due time and completion | Basic feature proposed free; additional logins remain paid |
| Café website | Paid; populated from café information using themes and fixed layouts | Proposed small theme/layout set, platform URL, branch selection and guest pickup ordering |
| Online orders | Paid website is the first automated order source | Pickup first proposed; initial manual payment confirmation versus gateway rollout is open |
| Customer assistant | Limited RAG included in the monthly paid plan | Customer FAQ/order link only initially; allowance, pooling and trial quota remain open |
| Basic FAQ | Saved answers without generative AI | Proposed within paid website; no standalone free website implied |
| Offline counter | Paid; one prepared offline register per branch initially | Supported devices, grace period, local recovery and reconnect rules need validation |
| Facebook/Messenger | WIP pending supported implementation and Meta review | Prepare early; not a launch dependency for website ordering |

## Scope guardrails

Keep the website to predefined sections and layouts. Keep stock to ingredients and simple recipes. Keep the first assistant focused on approved café information and ordering guidance. Include branch access, plan limits and offline transaction contracts in architecture now, while sequencing implementation into milestones.

Deferred: unrestricted website builder, table-map/split-bill engine, complex promotions, inventory transfers/batches/forecasting, full accounting, delivery dispatch, branch chat, advanced loyalty, owner-facing AI helper, arbitrary analytics and offline operation of every module.

An addition needs a user, recurring problem, smallest useful behavior and an explicit tradeoff. Planning support for a paid capability does not mean every paid module must ship in the first coding milestone.

## Commercial details deliberately open

No monthly price, AI quota, extra-seat price or location price is set. One-owner inclusion, paid catalogue capacity, trial activation/expiry and whether free businesses can buy individual extensions remain open. When resumed, cost the included AI allowance together with hosting, storage, notifications, support and the free-user base.

Suggested AI behavior: visible usage meter, reset each subscription billing month, then fall back to saved answers/staff at the limit. No automatic overage charges are currently specified.

## Current release artifact

The repository currently contains a browser-only **workflow prototype**, not production free or paid plans. Its sample tax-free totals, full refunds, locally stored orders and single sample branch are review simplifications. They do not settle the production fiscal, payment, permission or offline design.


## Relax deployment direction

Kyle confirmed Relax, the green identity, `relax.afkcube.com` as the product website, `/{cafe-slug}` as café pages and `/_console` as the operator console. OTOM is a reference for tenant databases, migrations and administration. The foundation uses path-based tenancy, a platform SQLite database and separate business databases. Owner setup is at `/{slug}/_app`; the counter is still sample-data-only at `/_demo/`. First café menu publishing is implemented with a fixed layout. Selectable themes/layouts and automated online orders remain planned. Prices, paid package caps and AI quotas remain deferred.
