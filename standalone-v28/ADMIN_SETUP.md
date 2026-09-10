# MaxTour admin CRM setup

The `/admin/` application contains no customer records before authentication. Its data is loaded from D1 through protected `/api/admin/*` routes.

Before the first live login:

1. Apply D1 migrations, including `0002_admin_crm.sql`.
2. Create a long random one-time setup secret in Cloudflare:

   ```sh
   npx wrangler secret put ADMIN_SETUP_TOKEN --config wrangler.jsonc
   ```

3. Open `/admin/` and create the first administrator with that secret.

The setup endpoint closes automatically after the first admin user exists. Passwords are stored only as salted PBKDF2-SHA256 hashes. Admin sessions are separate from tourist sessions, expire after eight hours, and all mutations require a CSRF token.

`ADMIN_USD_RUB_RATE` may be configured as a Worker variable when legacy USD bookings need a different display conversion rate. The demo fallback is `100`.

Messages and broadcasts are persisted with the `queued` status. A Telegram, email, WhatsApp, Bitrix24, or amoCRM delivery adapter can consume this queue after the target CRM/integration is selected.
