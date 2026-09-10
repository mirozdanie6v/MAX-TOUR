# MAX TOUR — standalone v28 demo

Standalone implementation of the exact supplied `maxtour-miniapp-prototype-v28.html` and `maxtour-demo-catalog-v28.json`.

It does **not** import, extend or depend on the repository's existing React application.

## Exact-source guarantee

The two supplied source files are stored in `source/` as checksummed gzip+base64 chunks because the original HTML contains large embedded image payloads. `build.mjs` reconstructs them byte-for-byte and verifies SHA-256 before every build.

- HTML SHA-256: `be7cceb157e1169f869ad11ead32bdc012f076d7aeddf5a36adf10fe25ca9472`
- Catalog SHA-256: `fc380915d882e9ed27b55a957c86dbba5dbcedb2e8be4892593b1bb5a427c1d4`

The build then injects the runtime adapters before `</body>`. No existing v28 source HTML is rewritten.

The administrator prototype is published separately at `/admin/`. It is based on the approved admin cabinet v3 and is linked to the tourist interface through the role switch in both headers.

## Architecture

- `source/` — exact supplied v28 sources, losslessly packaged and checksummed.
- `src/runtime-api.js` — persistence plus wiring for prototype controls that had no handler.
- `src/admin-v3.html` — self-contained administrator cabinet prototype.
- `src/role-switch.*` — top-level tourist/administrator role navigation.
- `src/worker.js` — Cloudflare Worker API + static assets.
- `migrations/` — dedicated D1 schema for demo sessions, bookings, travelers, favorites and admin demo actions.
- `build.mjs` — reconstructs exact sources and produces `dist/`.

The original React project at repository root is not used by this demo.
