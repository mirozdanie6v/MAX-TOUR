# MAX TOUR — pre-external production readiness

This document defines the exact handoff point between code that VIIVERSION can complete independently and configuration that requires MAX TOUR or an external provider.

## Completed without external credentials

- React/TypeScript client and Cloudflare Worker.
- Cloudflare D1 schema, migrations and verified seed.
- Server-side booking quote and order creation.
- Idempotent order creation and DEMO payment records.
- Manager order execution, first-contact tracking and SLA queue.
- Customer CRM records, notes, tags and follow-up tasks.
- Reschedule, cancellation and no-show operational workflow.
- Admin catalog, prices, schedule/availability, promotions and directions.
- Owner dashboard, sales target, source analytics and immutable audit trail.
- Telegram Mini App `initData` HMAC verification.
- Manager/Admin/Owner RBAC and first-owner bootstrap mechanism.
- Staff account management and assignable staff directory.
- Telegram notification outbox, webhook handler and webhook configuration code.
- Tilda webhook inbox, duplicate-safe lead identity, payload size limit and field normalization.
- Demo-session expiry/cleanup.
- 128 KB JSON API request limit.
- Browser cross-site mutation guard while provider webhooks remain exempt.
- Security response headers.
- CI: dependency audit, typecheck, unit tests, build, local migrations, seed idempotency, schema verification and Wrangler dry-run.
- Production deployment runner with remote D1 migration, Worker/assets deploy, custom domain and smoke test.

## External inputs required to move from demo/prepared mode to real operation

### Telegram

Required Cloudflare secrets/variables:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `TELEGRAM_MANAGER_CHAT_ID`
- `TELEGRAM_OWNER_CHAT_ID`
- Bootstrap Owner Telegram user ID (`BOOTSTRAP_OWNER_TELEGRAM_ID` when used)
- Actual Telegram user IDs for staff accounts

Activation sequence:

1. Add Telegram secrets in Cloudflare; never commit them to Git.
2. Add/bootstrap the first Owner.
3. Owner creates Manager/Admin/Owner staff accounts.
4. Verify `/api/owner/readiness` shows Telegram transport/access blockers cleared.
5. Configure the Telegram webhook.
6. Verify signed Mini App `initData` for every staff role.
7. Only then switch `AUTH_MODE` from `demo` to `telegram`.

### Tilda

Required:

- `TILDA_WEBHOOK_SECRET`.
- Confirmed list of actual forms that create leads/orders.
- Exact field names and hidden tour/date identifiers from those forms.
- Decision for unmatched/partial forms: ignore, create lead only, or create booking draft.

The webhook transport is intentionally not allowed to invent a tour/order mapping before this information is confirmed.

### Payments

Required before real money handling:

- payment provider selected by MAX TOUR;
- merchant account/credentials;
- provider webhook/callback verification mechanism;
- exact commission/fee rules;
- refund/cancellation rules mapped to provider operations;
- production test/sandbox cases supplied by the provider.

Rules:

- frontend success is never authoritative proof of payment;
- only a verified provider callback/webhook may mark a real payment completed;
- idempotency must be preserved for charge and callback processing;
- real refunds are never simulated by the current DEMO workflow.

### Live schedule / capacity

Required:

- authoritative source for departure dates and available seats;
- rules for capacity changes and temporary seat holds;
- hold expiration policy;
- conflict behavior when two customers attempt the final place;
- cancellation/release behavior.

Until this is supplied, D1 availability remains a demonstrational/admin-managed layer rather than a claim of live inventory.

### Production media

Required:

- client-approved/licensed production images;
- final decision whether the client assets are stored in Cloudflare R2;
- ownership/licensing confirmation for third-party images before production use.

## Production activation gate

Before enabling real staff auth, real payments or real inventory, all of the following must be true:

- current `main` CI is green;
- remote D1 migrations are applied successfully;
- production `/api/health` smoke is green;
- `/api/owner/readiness` reports no missing internal database tables;
- every enabled external integration has its real secret/configuration;
- Telegram Owner access is verified before `AUTH_MODE=telegram`;
- payment callback authenticity is verified with the selected provider;
- live inventory source is confirmed by MAX TOUR;
- no secret values exist in Git history or frontend bundle.

## Rollback

If a production release fails after deployment:

1. Keep `AUTH_MODE=demo` unless real staff authorization has already been fully verified.
2. Stop/disable the affected external webhook at the provider side when the issue is integration-specific.
3. Redeploy the previous known-good MAX TOUR `main` commit through the same Cloudflare deployment runner.
4. Do not reverse D1 migrations by deleting production data. Apply a forward corrective migration when schema repair is required.
5. Verify `/api/health`, homepage load and the affected integration status before reopening the external channel.

## Definition of “pre-external complete”

The project is pre-external complete when the application, D1 schema, internal workflows, security boundaries, tests, diagnostics and deployment process are functional without inventing credentials or business data that only MAX TOUR/provider systems can supply.
