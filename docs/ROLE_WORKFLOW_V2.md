# MAX TOUR — Role workflow v2

Updated: 2026-09-09

## Goal

The demo now separates operational responsibilities instead of treating Manager/Admin/Owner as interchangeable dashboards. All mutable actions below are isolated to the current public demo session and stored in D1.

## Tourist

**Purpose:** complete the purchase path without a manager.

Flow:
1. Select excursion.
2. Read the program, price, inclusions and details.
3. Select DEMO availability date.
4. Enter adults/children and required participant data.
5. Enter hotel/transfer details.
6. Receive server-authoritative quote.
7. Create order.
8. Complete simulated payment.
9. See booking in My Trips.

Result: the same D1 order enters the Manager queue and Owner overview.

## Manager

**Purpose:** execute and confirm orders, not edit the commercial product.

Manager can now:
- filter the order queue;
- open the order;
- change order status: New / Paid / Confirmed;
- assign a responsible manager;
- edit pickup/transfer clarification;
- add an internal operational note;
- mark that the customer was contacted;
- see customer/contact, hotel, source, amount, paid and remaining.

Manager deliberately cannot change tour price/program. That belongs to Admin and avoids uncontrolled commercial changes during order processing.

## Administrator

**Purpose:** maintain the product sold through Telegram/site.

Admin can now:
- create a new DEMO tour with a backend-valid payload;
- edit an excursion title;
- edit adult price;
- edit description;
- edit program items;
- publish/unpublish an excursion;
- add/update DEMO availability;
- create/update DEMO promotion;
- add a DEMO direction;
- inspect source analytics.

Changes to verified tours are stored as session-scoped D1 overrides. Base verified MAX TOUR records remain unchanged.

## Owner

**Purpose:** control the business rather than process every individual booking.

Owner panel now shows:
- number of orders;
- gross DEMO order volume;
- paid amount;
- outstanding amount;
- conversion;
- published tours / total tours;
- order queue by status;
- sources and order volume;
- recent orders;
- the Tourist → Manager → Admin → Owner workflow.

Owner can edit DEMO operating rules:
- manager response SLA in minutes;
- whether manager notifications should be enabled;
- owner digest frequency;
- sales focus.

These settings demonstrate governance UX only. Actual notifications/SLA automation require production integrations.

## Shared business logic

```text
Telegram Mini App / Tilda
          ↓
   Unified order model
          ↓
 Manager: execution + communication
          ↕
 Admin: product + prices + schedule
          ↓
 Owner: KPIs + queue + team rules
```

### Responsibility boundary

| Domain | Tourist | Manager | Admin | Owner |
|---|---:|---:|---:|---:|
| Browse/book/pay demo | ✓ |  |  | view outcome |
| Order status |  | edit |  | monitor |
| Responsible manager / notes |  | edit |  | monitor |
| Tour title/content |  |  | edit | monitor |
| Price |  |  | edit | monitor |
| Schedule/promo/directions |  |  | edit | monitor |
| Analytics | own journey | queue KPIs | source/product analytics | business overview |
| Team operating rules |  | follow | follow | edit |

This prevents the common anti-pattern where a manager can accidentally rewrite prices while processing a booking, while the owner is forced to work inside an administrator screen.

## Still not production-complete

### P0 — external/live integrations
1. Real Telegram bot transport, token, server-side initData validation and customer confirmations.
2. Real Tilda → Worker/D1 synchronization.
3. Real payment provider, callbacks/webhooks, reconciliation, retries and refunds.
4. Authoritative live schedule, capacity and seat locking.
5. Real customer/manager notifications and SLA automation.

### P1 — identity and operations
6. Production authentication and RBAC for Manager/Admin/Owner. Public role switching is demo-only.
7. Map assigned managers to actual staff accounts/team directory rather than free-text demo names.
8. Full immutable audit history for manager/admin/owner edits.
9. Full CRM/customer card: contact history, purchases, tasks, segmentation and notes.
10. Cancellation/reschedule/refund/no-show operational workflows.

### P1 — admin completeness
11. Gallery upload/reorder and project-owned media management.
12. Edit included/excluded items and what-to-take lists.
13. Edit child pricing rules and private-tour pricing tiers safely.
14. Edit pickup/transfer zones and commercial rules.
15. Validation/preview before publishing complex pricing changes.

### P1 — owner completeness
16. Current Owner dashboard is intentionally current-demo-session scoped. Production Owner must aggregate all authorized business orders, not isolated browser demo sessions.
17. Real reporting periods, comparison periods, exports and targets.
18. Real notification/SLA performance and team accountability metrics.

### P1 — brand/content/QA
19. Current header uses the corrected current-site MAX TOUR graphic. Obtain a client-approved original vector/high-resolution logo for production ownership.
20. Move approved/licensed imagery into project-owned Cloudflare assets and WebP/AVIF.
21. Give every catalog tour 4–6 semantically exact photos.
22. Complete Telegram WebView QA on Android/iOS at 360/390/430 px, safe areas, keyboard and slow-network fallbacks.

### P2 — final package dependent
23. RU/EN/VI localization if included in signed scope.
24. Marketing attribution integrations if promotion services are included.
25. Full Tilda/site modernization if included beyond integration.
