# SokoYetu deployment checklist

## Before production

- Apply `docker/postgres/migrations/001_checkout_hardening.sql` to the production database.
- Set a long, unique `JWT_SECRET`; never deploy the example value.
- Set `FRONTEND_URL` to the exact public frontend address and set `REACT_APP_API_URL` to the public API address.
- Use the production pawaPay base URL and production API token only after sandbox checkout has passed.
- Configure `PAWAPAY_CALLBACK_URL` as a public HTTPS endpoint ending in `/api/payments/pawapay/callback/deposit`.
- Set `PAWAPAY_SIGNED_CALLBACKS_ENABLED=true` for production and confirm callback signature verification with pawaPay.
- Confirm the deployment database includes `payments.provider_code` and `products.description`.

## Release checks

- Retailer can register, browse a manufacturer, place an order, approve a Mobile Money prompt, and see payment confirmation.
- A payment failure can be retried without creating another order.
- A manufacturer can update only its own products and orders.
- A retailer cannot view another retailer's payment status.
- A product cannot be ordered when stock is insufficient.
