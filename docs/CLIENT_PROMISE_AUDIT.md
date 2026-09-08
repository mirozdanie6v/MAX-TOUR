# MAX TOUR — audit against the commercial proposal and buyer request

Updated: 2026-09-09

## Purpose

This document compares the currently implemented MAX TOUR Telegram Mini App demo with the functionality promised/discussed for the client. It deliberately separates what is **real in the demo now** from what still requires **production integration** before a live business launch.

## Current demo — implemented

### Premium customer experience
- Completely rebuilt photo-first premium travel UI.
- MAX TOUR branding/logo area in the header; no previous-client branding.
- Current-site MAX TOUR graphic used in header with text fallback; final client-supplied vector asset is still recommended for production.
- Large editorial hero focused on Vietnam travel rather than a generic SaaS dashboard.
- Premium collection, direction navigation, signature Dalat experience, richer photo storytelling and service-value blocks.
- Responsive mobile-first layout and Telegram WebView-compatible runtime.
- Bottom navigation labels enlarged for mobile readability.
- Separate Bot screen removed. `/bot` redirects to the tourist home.
- Demo role switching moved into the right-side hamburger menu: Tourist / Manager / Administrator / Owner.

### Tourist self-service journey
- Tour catalog and filtering by direction/category.
- Detailed tour page with program, photos, pickup/return, inclusions and extra costs.
- Date selection using clearly marked DEMO AVAILABILITY.
- Adult/child count and child-height input.
- Hotel and participant data.
- Server-authoritative price calculation.
- Booking creation in Cloudflare D1.
- DEMO payment flow with no real money movement.
- Success state and My Trips.
- Trip detail with amount paid/remaining and cancellation/reschedule summary.

### MAX TOUR-specific pricing proof
- Dalat Premium adult: $52.
- Child 112 cm: $38.
- 2 adults + child: $142.
- Amiana / 3 travellers transfer: +$20.
- Total: $162.
- DEMO 30% payment: $48.60.

### Manager handoff and operational editing
- The actual tourist-flow order is persisted in D1 and becomes visible in Manager.
- Manager list supports New / Paid / Confirmed filtering.
- Manager order detail shows tour, date, customer/contact, hotel, source, amount, paid and remaining.
- Manager can change status and the change persists in D1.
- Manager can edit responsible manager, pickup/transfer clarification and internal operational note.
- Manager can mark that the customer was contacted.
- Manager deliberately cannot rewrite excursion price/program; product changes are owned by Admin.
- Fresh/reset demo sessions include five clearly marked synthetic orders across Telegram, Site, Advertising and Other Channels so the interface is presentation-ready before the buyer creates a new order.

### Existing Tilda + Telegram concept
- Dedicated visual proof shows Tilda and Telegram as two sales channels feeding one booking model and one manager queue.
- The screen is architecture/demo proof only; it does not claim that production Tilda synchronization is already enabled.

### Admin / product management
- Tour list.
- Working DEMO tour creation with backend-valid payload.
- Tour title editing.
- Adult-price editing using the backend-supported `adultMinor` field.
- Description and program editing.
- Publish/unpublish control.
- DEMO schedule/availability editing.
- DEMO promo editing.
- Direction list and DEMO direction creation.
- Changes are session-scoped and persisted in D1.

### Owner panel
- Separate Owner role and dashboard added.
- Shows order count, gross DEMO volume, paid/outstanding amounts, conversion and catalog publication status.
- Shows queue by status, source breakdown and recent orders.
- Shows the business workflow Tourist → Manager → Admin → Owner.
- Owner can edit DEMO operating settings: manager SLA, manager-notification toggle, digest frequency and sales focus.
- Owner metrics/settings are intentionally current-demo-session scoped; they are not presented as global historical MAX TOUR business data.

### Analytics
- Views, booking starts, orders, payments/revenue are represented.
- Source funnel is visible.
- Analytics data is clearly labeled DEMO and is not presented as historical MAX TOUR performance.
- Fresh/reset sessions have a richer seeded funnel so the screen is useful immediately.

### Multi-direction architecture
Verified default directions represented in the product model:
- Nha Trang
- Da Nang
- Phu Quoc
- Mui Ne / Phan Thiet
- Hanoi
- Premium category / collection

Admin also demonstrates adding another DEMO direction.

## Comparison with the buyer request

| Buyer/client requirement | Current status | Evidence in demo |
|---|---|---|
| Show what the Telegram app looks like | DONE | Premium tourist Mini App UI |
| Tourist independently chooses an excursion | DONE | Catalog + tour detail |
| Chooses date | DONE (DEMO availability) | Booking flow |
| Chooses number of people | DONE | Adults/children counters |
| Receives required excursion information | DONE | Program, images, pickup/return, included/extras |
| Creates an order without a manager | DONE | Worker API + D1 order |
| Passes payment flow without a manager | DONE as DEMO | Payment screen + D1 simulated payment |
| Order becomes available to manager | DONE | Same session D1 Manager queue |
| Manager can work with the order | DONE as DEMO | Status + responsible manager + transfer/internal notes + contact mark |
| Show link between current Tilda site and Telegram | DONE as architecture demo | Tilda + Telegram screen |
| Add/edit excursions | DONE for demo | Admin |
| Change prices | DONE for demo | Admin tour edit |
| Change schedule | DONE for demo | Admin schedule |
| Create/change promotions | DONE for demo | Admin promo |
| Show source → tour → orders → payments analytics | DONE as DEMO | Analytics |
| Give owner a high-level control view | DONE as DEMO | Owner dashboard + operating settings |
| Demonstrate scaling to cities/directions | DONE | Direction model + Admin add direction |
| Real production payment acquiring | NOT YET | Requires provider decision/integration |
| Real production Tilda synchronization | NOT YET | Requires webhooks/API integration |
| Real live inventory / seat capacity | NOT YET | Demo availability only |
| Production authentication / role permissions | NOT YET | Public role switch is demo-only |

## Role workflow

Detailed role/business logic is fixed in `docs/ROLE_WORKFLOW_V2.md`.

Core responsibility split:
- **Tourist** — selects, books and passes payment flow.
- **Manager** — processes the order and communicates with the client.
- **Admin** — maintains the product, price, content, schedule, promos and directions.
- **Owner** — monitors KPIs/queue and sets operating rules.

This separation intentionally prevents an order-processing manager from changing commercial product rules and prevents the owner from having to work inside a product-editor screen.

## What still needs to be completed before a real business launch

### P0 — production integrations
1. **Real Telegram transport and identity validation.** Configure the client bot token as a Cloudflare secret, validate Telegram `initData` server-side, add webhook/confirmation messages and open the Mini App from the real MAX TOUR bot.
2. **Real Tilda integration.** Connect current Tilda entry points/forms to the same backend/order pipeline and verify that orders from website and Telegram share one real customer/order model.
3. **Real payment provider.** MAX TOUR must choose the provider/merchant setup; then implement checkout, callbacks/webhooks, reconciliation, retry/error/refund states. Do not invent commissions or providers before this decision.
4. **Live schedule and capacity.** Replace DEMO AVAILABILITY with an authoritative schedule source, capacity, seat locking and race-condition protection.
5. **Production notifications and SLA automation.** Owner SLA/notification controls currently demonstrate UX only.

### P1 — identity and operations
6. **Authentication and RBAC.** Tourist/Manager/Admin/Owner are deliberately switchable in the public demo. Production needs protected role permissions.
7. **Real staff assignment.** Replace free-text demo manager assignment with actual staff accounts/team directory.
8. **Immutable audit history.** Record manager/admin/owner mutations with actor/time/before/after state.
9. **Full CRM/customer card.** Add contact history, previous trips, repeat purchase history, tasks, search/segmentation and notes if included in final scope.
10. **Operations states.** Add cancellation/reschedule workflow, refunds, no-show, capacity changes and a complete audit trail.

### P1 — admin completeness
11. Gallery upload/reorder and project-owned media management.
12. Edit included/excluded lists and what-to-take content.
13. Edit child-pricing rules and private-tour pricing tiers safely.
14. Edit pickup/transfer zones and related business rules.
15. Preview/validation before publishing complex pricing changes.

### P1 — owner completeness
16. Current Owner dashboard intentionally aggregates only current demo-session data. Production Owner must aggregate all authorized business orders/data.
17. Reporting date ranges, comparison periods, targets and exports.
18. Real SLA/notification performance and team accountability metrics.

### P1 — visual/content hardening
19. **Client-approved brand asset.** Current header is corrected to a current-site MAX TOUR graphic. Obtain the original vector/high-resolution logo file from the client for production ownership and certainty.
20. **Own all production imagery.** Move approved/licensed images into project-owned Cloudflare assets, convert to WebP/AVIF and remove hotlink dependence.
21. **Photo coverage for every tour.** Bring every catalog tour to a consistent 4–6 semantically exact photos.
22. **Device/Telegram QA.** Finish screenshot-based QA on representative 360/390/430 px Android/iOS Telegram WebViews, safe areas, keyboard/form behavior and slow-network image fallbacks.

### P2 — depending on final commercial package
23. Multilingual RU/EN/VI content if included in signed scope.
24. Real marketing integrations/advertising attribution if promotion services are purchased.
25. Website modernization beyond integration if the final package includes rebuilding the Tilda customer experience rather than only connecting it.

## Presentation readiness conclusion

The current product demonstrates the core promise as a working full-stack future-sales-system demo rather than a static catalog: premium customer path, server-side pricing, D1 order handoff, editable Manager operations, editable Admin product management, Owner control view, analytics and a unified Tilda/Telegram architecture.

It should still be described as a **working demonstration of the future MAX TOUR sales and operations system**, not as a finished live booking platform. The P0 items above are the boundary between the current demo and a system handling real customer identity, live inventory and real money.
