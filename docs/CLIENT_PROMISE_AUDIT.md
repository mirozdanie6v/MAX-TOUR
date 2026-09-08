# MAX TOUR — audit against the commercial proposal and buyer request

Updated: 2026-09-09

## Purpose

This document compares the currently implemented MAX TOUR Telegram Mini App demo with the functionality promised/discussed for the client. It deliberately separates what is **real in the demo now** from what still requires **production integration** before a live business launch.

## Current demo — implemented

### Premium customer experience
- Completely rebuilt photo-first premium travel UI.
- MAX TOUR branding/logo area in the header; no previous-client branding.
- Large editorial hero focused on Vietnam travel rather than a generic SaaS dashboard.
- Premium collection, direction navigation, signature Dalat experience, richer photo storytelling and service-value blocks.
- Responsive mobile-first layout and Telegram WebView-compatible runtime.
- Separate Bot screen removed. `/bot` redirects to the tourist home.
- Demo role switching moved into the right-side hamburger menu: Tourist / Manager / Administrator.

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

### Manager handoff
- The actual tourist-flow order is persisted in D1 and becomes visible in Manager.
- Manager list supports New / Paid / Confirmed filtering.
- Manager order detail shows tour, date, customer/contact, hotel, source, amount, paid and remaining.
- Status changes persist in D1.
- Fresh/reset demo sessions include five clearly marked synthetic orders across Telegram, Site, Advertising and Other Channels so the interface is presentation-ready before the buyer creates a new order.

### Existing Tilda + Telegram concept
- Dedicated visual proof shows Tilda and Telegram as two sales channels feeding one booking model and one manager queue.
- The screen is architecture/demo proof only; it does not claim that production Tilda synchronization is already enabled.

### Admin / Director
- Tour list.
- Quick DEMO tour creation.
- Tour description and adult-price editing.
- DEMO schedule/availability editing.
- DEMO promo editing.
- Direction list and DEMO direction creation.
- Changes are session-scoped and persisted in D1.

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
| Show link between current Tilda site and Telegram | DONE as architecture demo | Tilda + Telegram screen |
| Add/edit excursions | DONE for demo | Admin |
| Change prices | DONE for demo | Admin tour edit |
| Change schedule | DONE for demo | Admin schedule |
| Create/change promotions | DONE for demo | Admin promo |
| Show source → tour → orders → payments analytics | DONE as DEMO | Analytics |
| Demonstrate scaling to cities/directions | DONE | Direction model + Admin add direction |
| Real production payment acquiring | NOT YET | Requires provider decision/integration |
| Real production Tilda synchronization | NOT YET | Requires webhooks/API integration |
| Real live inventory / seat capacity | NOT YET | Demo availability only |

## What still needs to be completed before a real business launch

### P0 — production integrations
1. **Real Telegram Bot transport and identity validation.** Configure the client bot token as a Cloudflare secret, validate Telegram `initData` server-side, add webhook/confirmation messages and open the Mini App from the real MAX TOUR bot. The customer-facing Mini App already works without this dependency for the demo.
2. **Real Tilda integration.** Connect the existing Tilda forms/catalog entry points to the same backend/order pipeline, define webhook/API mapping and verify that orders from the site and Telegram share one customer/order model.
3. **Real payment provider.** MAX TOUR must choose the provider/merchant setup; then implement checkout, callbacks/webhooks, payment status reconciliation, error/retry/refund states. Do not invent commissions or providers before this decision.
4. **Live schedule and capacity.** Replace DEMO AVAILABILITY with an authoritative schedule source, availability/capacity, seat locking and race-condition protection.
5. **Production notifications.** Add customer confirmation/reminders and manager notifications through the selected real channels.

### P1 — production operations
6. **Authentication and RBAC.** Tourist, manager and administrator are deliberately switchable in the public demo. Production needs protected Manager/Admin authentication and role permissions.
7. **Full CRM/customer card.** Add customer profile, contact history, previous trips, repeat purchase history, search/segmentation and notes if these remain in the final package.
8. **Full tour editor.** Extend Admin beyond the current demo fields: gallery upload/order, program editor, included/excluded, child rules, private-tour pricing tiers, pickup zones, SEO/content fields if the same data feeds the site.
9. **Production analytics attribution.** Persist real UTM/referrer/Telegram source data, reporting periods, source taxonomy, conversion definitions and exports/dashboard access for the director.
10. **Operations states.** Add cancellation/reschedule workflow, refunds, no-show, capacity changes and an audit trail beyond the current status proof.

### P1 — visual/content hardening
11. **Client-approved brand assets.** Obtain the highest-resolution official MAX TOUR logo/brand file and confirm final brand colors/type choices with the client. Current premium design intentionally extends the brand for the demo.
12. **Own all production imagery.** Current demo may use external high-quality travel imagery under the approved demo image policy. Before production, move licensed/client-approved images into project-owned Cloudflare assets, convert to WebP/AVIF and remove hotlink dependence.
13. **Photo coverage for every tour.** Dalat Premium already has a substantial itinerary-specific gallery. Bring every catalog tour to a consistent 4–6 semantically exact photos before client-facing production release.
14. **Device/Telegram QA.** Finish screenshot-based QA on representative 360/390/430 px Android/iOS Telegram WebViews, safe areas, keyboard/form behavior, Telegram BackButton/MainButton and slow-network image fallbacks.

### P2 — depending on final commercial package
15. Multilingual RU/EN/VI content if included in the signed scope.
16. Real marketing integrations/advertising attribution if promotion services are purchased.
17. Website modernization beyond integration if the final package includes rebuilding the Tilda customer experience rather than only connecting it.

## Presentation readiness conclusion

The current product now demonstrates the core promise significantly better than a simple catalog: the buyer can see a premium MAX TOUR-specific customer experience, complete self-service booking/payment simulation, actual D1 order handoff to Manager, operational Admin controls, analytics and the unified Tilda/Telegram architecture.

It should still be described as a **working full-stack demonstration of the future sales system**, not as a finished production booking platform. Items in P0 are the boundary between the current proof and a live customer-money / live-inventory system.
