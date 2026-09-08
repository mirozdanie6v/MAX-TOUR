# MAX TOUR Vietnam — Telegram Mini App demo

Full-stack demonstration product for MAX TOUR Vietnam, implemented from the v4 execution prompt as a React/TypeScript application with a Cloudflare Worker API and D1 persistence.

## Status

- Production: **DEPLOYED**
- Production domain: `https://max-tour.viiversion.com/`
- Frontend: React + TypeScript + Vite
- Backend: Cloudflare Worker + TypeScript
- Database: Cloudflare D1 (`DB` binding, database name `max-tour-demo`)
- External money movement: simulated
- Tilda production sync: simulated architecture proof
- Telegram Bot API transport: simulated unless real bot credentials are explicitly configured

Production is considered deployed only while both the homepage and `/api/health` are verified on the custom domain.

## Why this demo exists

The demo is designed to answer the exact client questions that also structure the commercial proposal:

1. what the Telegram bot and Mini App look like;
2. how a tourist independently selects a tour/date/participants, receives information, books and follows a payment flow;
3. how the same order becomes visible to a manager;
4. how the existing Tilda site and Telegram can become two channels of one booking model;
5. how MAX TOUR can edit/add tours, prices, demo schedules and promotions;
6. how source → tour → order → payment analytics can look;
7. how the model scales to multiple verified directions.

Development pricing, implementation timelines, payment-provider commissions, advertising results and revenue promises are intentionally kept out of the customer Mini App and belong in the commercial proposal.

## Architecture

```text
Browser / Telegram WebView
        |
        v
React + React Router (Vite)
        |
        | same-origin /api/*
        v
Cloudflare Worker (TypeScript)
        |
        v
Cloudflare D1
   |                |
verified base     session-scoped demo data
immutable facts   orders / payment demo / overrides / analytics
```

The Worker creates a cryptographically random demo session and stores it in an HttpOnly SameSite cookie. Mutable demo data is isolated by `session_id`. A new browser session sees the verified baseline and does not inherit another visitor's mutations.

## Data model

Main D1 entities:

- `app_settings`
- `destinations`
- `tours`
- `demo_sessions`
- `demo_tour_overrides`
- `demo_user_created_tours`
- `demo_availability`
- `demo_promotions`
- `demo_directions`
- `orders`
- `order_participants`
- `payments`
- `analytics_events`
- `manager_status_history`

Money is stored as integer minor units. Final quotes and order totals are recalculated by the Worker; totals supplied by the browser are never trusted.

## Official MAX TOUR source URLs used

Business/product facts are seeded from MAX TOUR pages checked during implementation:

- https://maxtourvietnam.com/
- https://maxtourvietnam.com/ekskursiya-v-dalat-iz-nyachanga-premium
- https://maxtourvietnam.com/ekskursiya-v-fuyen-iz-nyachanga
- https://maxtourvietnam.com/vip-ekskursiya-v-dalat-iz-nyachanga
- https://maxtourvietnam.com/ekskursiya-v-dalat-so-steklyannym-mostom-iz-nyachanga
- https://maxtourvietnam.com/dnevnaya-obzornaya-ekskursiya-po-nyachangu
- https://maxtourvietnam.com/vechernyaya-obzornaya-ekskursiya-po-nyachangu
- https://maxtourvietnam.com/ekskursiya-v-dalat-na-2-dnya-iz-nyachanga
- https://maxtourvietnam.com/hanoj-halong-iz-nyachanga-2-dnya

## Data verification notes

- The flagship Dalat Premium detail page is treated as the source of truth for its itinerary, prices and participant requirements.
- Dalat Premium group logic: adult `$52`; height `<=100 cm` free; `>100 cm && <=120 cm` `$38`.
- Acceptance demo: 2 adults + one 112 cm child = `$142`; Amiana / 3 travellers adds `$20`; total `$162`; 30% demo deposit = `$48.60`.
- The 30% value is a **DEMO CONFIGURATION**, not a claim that Dalat Premium currently has a fixed 30% deposit. MAX TOUR's general site rule is 30–100%.
- Availability dates and “available / low / request” statuses are `DEMO AVAILABILITY`, not live inventory.
- Analytics values are `DEMO ANALYTICS` and are not historical MAX TOUR/VIIVERSION performance.
- Promotions created in Admin are `DEMO PROMO` and are session-scoped.
- User-created tours/directions are marked `userCreatedDemo`.
- No payment-provider commission, provider, merchant account, VietQR, VNPAY, ZaloPay or payOS is claimed as selected.

## Images

Images are intentionally separate from the business-data source-of-truth policy. High-quality travel imagery may come from external sources, but it must semantically match the exact tour/location. Dalat Premium has six distinct images aligned to its itinerary. For this demo the images are remote URLs; a production hardening pass should copy licensed/approved files into project-owned Cloudflare static assets and convert them to WebP/AVIF.

## API overview

System/session:
- `GET /api/health`
- `GET|POST /api/session`
- `POST /api/demo/reset`

Catalog/booking:
- `GET /api/destinations`
- `GET /api/tours`
- `GET /api/tours/:id`
- `GET /api/tours/:id/availability`
- `POST /api/booking/quote`
- `POST /api/orders`
- `POST /api/payments/demo`
- `GET /api/my-trips`

Manager:
- `GET /api/manager/orders`
- `GET /api/manager/orders/:id`
- `PATCH /api/manager/orders/:id/status`

Admin:
- `GET|POST /api/admin/tours`
- `PATCH /api/admin/tours/:id`
- `POST|PATCH /api/admin/tours/:id/schedule`
- `POST|PATCH /api/admin/tours/:id/promo`
- `GET|POST /api/admin/directions`
- `GET /api/admin/analytics`

## Demo modes / routes

- Bot: `/bot`
- Tourist home: `/`
- Catalog: `/catalog`
- Dalat Premium: `/tour/dalat-premium`
- Booking: `/booking/date` → participants → hotel → travelers → checkout → payment → success
- My Trips: `/trips`
- Manager: `/manager`
- Unified Tilda/Telegram proof: `/channels`
- Admin tours: `/admin`
- Schedule/promo: `/admin/schedule`
- Analytics: `/admin/analytics`
- Directions: `/admin/directions`

Append `?clean=1` to hide the demo role switcher for proposal screenshots.

Suggested screenshot states:

- S01 `/bot?clean=1`
- S02 `/?clean=1`
- S03 `/tour/dalat-premium?clean=1`
- S04 `/booking/checkout?clean=1` after completing participant inputs
- S05 `/booking/payment?clean=1`
- S06 `/manager/MT-DEMO-1048?clean=1` after creating the order
- S07 `/channels?clean=1`
- S08 `/admin/tours/dalat-premium?clean=1`
- S09 `/admin/analytics?clean=1`

## Local development

```bash
npm install
npm run cf:types
npm run db:migrate:local
npm run db:seed:local
npm run dev
```

Quality gates:

```bash
npm run typecheck
npm test
npm run build
```

The demo session cookie omits `Secure` on plain HTTP local development and uses `Secure` on HTTPS production.

## D1 migrations and seed

```bash
npm run db:migrate:local
npm run db:seed:local
npm run db:migrate:remote
npm run db:seed:remote
```

`seed/verified-max-tour-data.sql` is idempotent; rerunning it does not duplicate base tours/directions. Reset only clears mutable data for the current demo session and reseeds its synthetic demo availability/orders/analytics.

## Production deployment

Source code, CI and public production smoke checks live in this `MAX-TOUR` repository. Cloudflare credentials are intentionally **not duplicated into MAX-TOUR**.

Production deployment uses a protected shared runner in `mirozdanie6v/rusinfocenter`:

- workflow: `.github/workflows/deploy-max-tour-shared.yml`;
- credentials: existing `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repository secrets in the shared runner repository;
- source checkout: always `mirozdanie6v/MAX-TOUR@main`;
- deployment target: `max-tour-demo` + D1 `max-tour-demo` + `max-tour.viiversion.com`.

The shared deployment performs:

1. checkout of `MAX-TOUR/main`;
2. `npm ci`, typecheck, tests and production build;
3. remote D1 migrations;
4. idempotent verified seed;
5. Worker + React asset deployment;
6. custom-domain binding;
7. homepage and `/api/health` production smoke checks.

The normal RIC deployment ignores the MAX-TOUR trigger/workflow, so both products remain isolated even though the same secured Cloudflare credential store is reused.

No secret value belongs in source files, README or the frontend bundle.

## Real vs simulated

Real in this demo:
- React frontend;
- Worker API;
- D1 persistence;
- session isolation;
- verified catalog seed;
- server-side validation and pricing;
- order/payment-demo persistence;
- Manager status persistence;
- Admin overrides/add/schedule/promo/direction persistence;
- analytics event storage/filtering.

Simulated:
- actual bank/card money movement;
- concrete payment provider response;
- production Tilda sync;
- production inventory/seat locking;
- external manager notification transport;
- Telegram Bot API transport unless real credentials are separately configured;
- historical business analytics.

## Reset demo state

Admin → `Reset demo data`, or:

```bash
curl -X POST -H 'content-type: application/json' --cookie-jar cookies.txt --cookie cookies.txt \
  https://max-tour.viiversion.com/api/demo/reset -d '{}'
```

Reset affects only the current demo session.
