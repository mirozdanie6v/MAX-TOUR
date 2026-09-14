# MAX TOUR — Telegram Mini App Production Prototype

Canonical production: https://max-tour-demo.viiversion.com/
Health: https://max-tour-demo.viiversion.com/api/health

> `max-tour-demo.viiversion.com` is the only active MAX TOUR production target for ongoing development. Do not deploy product changes to `max-tour.viiversion.com`.

## Stack

- Standalone v28 customer application + JavaScript runtime adapters
- Cloudflare Worker API
- Cloudflare D1
- Cloudflare Worker Static Assets
- GitHub Actions CI
- Shared Cloudflare deployment runner in `mirozdanie6v/rusinfocenter`

## Canonical source

- Repository: `mirozdanie6v/MAX-TOUR`
- Branch: `demo/max-tour-demo`
- Application: `standalone-v28/`
- Production host: `max-tour-demo.viiversion.com`
- Production Worker service: `max-tour-demo-v28`
- Production D1: `max-tour-standalone-v28-db`

The repository-root React application and the old `max-tour.viiversion.com` target are not the production source of truth.

## Architecture

```text
Telegram Mini App / browser
          ↓ same-origin /api/*
Cloudflare Worker
          ↓ D1 binding
Cloudflare D1
```

## Roles

Role switching is available from the right hamburger menu in the current prototype.

- **Tourist** — catalog → detail → date → participants → hotel/transfer → quote → order → payment simulation → My Trips.
- **Manager** — order queue, statuses, responsible manager, pickup/transfer clarification, operational notes and customer contact.
- **Administrator** — tours, pricing, descriptions, programs, publication state, schedules, promo and directions.
- **Owner** — business KPIs, order queue, source mix and operating settings.

Detailed responsibility/business logic: `docs/ROLE_WORKFLOW_V2.md`.
Client-promise audit and remaining production work: `docs/CLIENT_PROMISE_AUDIT.md`.

## Important prototype boundary

The public role switch is a demonstration device, not production authorization. Manager/Admin/Owner access must be protected by real authentication + RBAC before a client-facing live launch.

## Catalog image policy

Every production catalog tour must have an explicit location-correct image set. `standalone-v28/src/catalog-image-overrides.json` is applied during the build to all 15 canonical tours. The build fails if any catalog ID is missing from the image policy or if the policy contains an unknown ID.

Images must be semantically exact to the excursion/location. Generic cross-location substitutions and unrelated landmark imagery are not allowed.

Official business/content source: https://maxtourvietnam.com/

## Deployment

Production deployment is executed from `mirozdanie6v/MAX-TOUR@demo/max-tour-demo` by `.github/workflows/deploy-max-tour-v28-shared.yml` in `mirozdanie6v/rusinfocenter`.

The deploy runner:
- checks out only `demo/max-tour-demo`;
- installs and tests `standalone-v28`;
- builds the standalone app;
- applies the isolated D1 migrations;
- deploys the `max-tour-demo-v28` Worker/assets;
- attaches `max-tour-demo.viiversion.com`;
- verifies the live application and `/api/health`.

No Cloudflare secret value is committed to this repository.

## Production verification

A production change is complete only after:
- tests/build succeed;
- D1 migrations succeed;
- Worker and assets deploy successfully;
- `max-tour-demo.viiversion.com` is attached and responds;
- `/api/health` succeeds;
- live smoke checks succeed;
- customer-visible behavior is checked on the production host.
