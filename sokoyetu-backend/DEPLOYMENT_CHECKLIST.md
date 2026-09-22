# SokoYetu deployment checklist

## Before production

- Migrations apply automatically on startup (`src/db/migrate.js`), so nothing needs applying by hand.
  Confirm the deploy logs a clean start: the backend refuses to listen if a migration fails or a
  required column is missing, rather than serving traffic against a schema it cannot read.
- Set a long, unique `JWT_SECRET`; never deploy the example value.
- Set `FRONTEND_URL` to the exact public frontend address and set `REACT_APP_API_URL` to the public API address.
- Use the production pawaPay base URL and production API token only after sandbox checkout has passed.
- Configure `PAWAPAY_CALLBACK_URL` as a public HTTPS endpoint ending in `/api/payments/pawapay/callback/deposit`.
- Set `PAWAPAY_SIGNED_CALLBACKS_ENABLED=true` for production and confirm callback signature verification with pawaPay.
- If the database user may not run DDL, set `MIGRATIONS_ON_STARTUP=false` and apply the migrations
  yourself with `npm run db:migrate`. Verification still runs, so a mismatch still stops the boot.

## Release checks

- Retailer can register, browse a manufacturer, place an order, approve a Mobile Money prompt, and see payment confirmation.
- A payment failure can be retried without creating another order.
- A manufacturer can update only its own products and orders.
- A retailer cannot view another retailer's payment status.
- A product cannot be ordered when stock is insufficient.
