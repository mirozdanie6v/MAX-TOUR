# MAX TOUR v29 — React rebuild plan

Status: IN PROGRESS
Branch: `v29-react-rebuild-20260909`
Production target: `https://max-tour.viiversion.com`
Source of truth: user attachments `maxtour-miniapp-prototype-v29.html` + `maxtour-demo-catalog-v29.json`.
Tracking issue: #8.

## Rule
Previous production UX/UI, old green/Georgia visual system, old client state and old D1 product model are not inputs to this rebuild. Existing repository infrastructure may be reused only where it does not alter v29 product behavior.

## Sequential stages

### 0. Freeze source of truth
- [x] Create dedicated branch.
- [x] Store HTML reference snapshot under `source-of-truth/`.
- [x] Record v29 state/navigation contract.
- [ ] Store normalized catalog snapshot used by React.
- [ ] Cross-check sample catalog records against attachment.

### 1. Data model
- [ ] Define TypeScript types + Zod schemas for Tour, TourFormat, Departure, RouteStop.
- [ ] Define FilterState, Booking, Traveler, Trip, TravelerDirectory, AppState.
- [ ] Separate source fields from derived UI/search fields.
- [ ] Add model validation tests.

### 2. Clean React shell + design system
- [ ] Replace previous client implementation.
- [ ] Montserrat 500/600/700/800/900.
- [ ] v29 tokens: cream/sand/red/orange/sea palette.
- [ ] 430px phone shell on desktop; full-width Telegram WebView behavior on mobile.
- [ ] Sticky top, scrollable content, fixed bottom nav.
- [ ] Header Admin entry and 7 v29 screens.

### 3. Home
- [ ] Hero + directions chips.
- [ ] Two hero actions.
- [ ] Quick Choice 2-column cards.
- [ ] Popular tours.

### 4. Catalog
- [ ] Search.
- [ ] City, duration, category, budget min/max, children filter.
- [ ] Reset.
- [ ] Tour cards with image, favorite, time, tags, group/individual prices.

### 5. Tour detail
- [ ] Hero, back, favorite.
- [ ] Proof strip.
- [ ] Group / Individual tabs.
- [ ] Departures/status/capacity.
- [ ] Price facts and notes.
- [ ] Route, included, take, gallery.
- [ ] CTA to booking.

### 6. Booking + payment
- [ ] Adults / children / infants steppers.
- [ ] Date + hotel/area.
- [ ] Dynamic traveler rows.
- [ ] Full name + birth date required for every traveler.
- [ ] First adult = primary traveler.
- [ ] 30% / 100% choice.
- [ ] СБП / Kaspi / VNPAY / Другой способ.
- [ ] QR DEMO step.
- [ ] Completion creates receipt/trip.

### 7. Trips + personal cabinet
- [ ] Booked trips list/detail.
- [ ] Receipt, paid/rest/total, participants, rules.
- [ ] Personal cabinet.
- [ ] Primary traveler.
- [ ] Companion directory with deduplication by fullName + birthDate.

### 8. AI helper + Admin
- [ ] AI helper behavior and visual hierarchy from v29.
- [ ] Admin screen behavior from v29 only.

### 9. Persistence
- [ ] Persist liked IDs.
- [ ] Persist demo trips.
- [ ] Persist traveler directory.
- [ ] Reset demo state.

### 10. QA
- [ ] Typecheck.
- [ ] Unit tests.
- [ ] Production build.
- [ ] Schema parses entire normalized catalog.
- [ ] `taken <= capacity` for departures.
- [ ] Derived `priceFromUsd` consistency checks where parseable.
- [ ] Traveler validation.
- [ ] Payment -> Trip -> Personal cabinet flow test.
- [ ] 360 / 390 / 430 px layout checks.
- [ ] No previous production visual tokens or text contamination.

### 11. Clean deploy
- [ ] Simplify Worker to React assets + `/api/health` for this prototype build.
- [ ] Remove old D1 migration/seed steps from this deployment path.
- [ ] Build from `v29-react-rebuild-20260909`.
- [ ] Replace `max-tour.viiversion.com` Worker/assets.
- [ ] Production `/api/health` smoke.
- [ ] Root UI smoke.

### 12. Final source comparison
- [ ] Compare Home/Catalog/Detail/Booking/Trips/AI/Admin against v29.
- [ ] Update issue #8 with actual completion state.
- [ ] Mark DEPLOYED only after smoke passes.
