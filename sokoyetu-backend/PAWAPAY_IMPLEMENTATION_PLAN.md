# pawaPay Mobile Money Implementation Plan

This plan turns the pawaPay integration spec into actionable backend and frontend work for SokoYetu.

## Goal

Add real Mobile Money checkout using pawaPay so a retailer can pay with MTN or Airtel, while keeping order payment status accurate and callback-driven.

## High-Level Outcome

- Retailer chooses Mobile Money at checkout.
- Backend initiates a pawaPay deposit.
- Retailer enters phone number and picks an available provider.
- pawaPay confirms the payment asynchronously.
- Local order payment state updates only after confirmation.

## Workstream 1: Backend Foundation

### 1. Add payment tracking to the database

Update:

- `/C:/Users/user/Documents/TASKs/sokoyetu-backend/src/db/schema.sql`

Recommended changes:

- Reuse the existing `payments` table instead of adding a new one.
- Treat `payments.external_id` as the pawaPay `depositId` field, since it is already a UUID and fits the pawaPay flow.
- Store provider and phone data in the existing `payments` columns:
  - `payment_method`
  - `phone_number`
  - `provider_reference`
  - `failure_reason`
- Keep `payments.status` as the payment state source of truth:
  - `pending`
  - `processing`
  - `completed`
  - `failed`
  - `cancelled`
- Keep `orders.payment_status` as a summary field if the UI still needs quick order-level payment state.

Optional but useful:

- Add a small `paid_at` column to `payments` or `orders` if reporting needs the completion timestamp.

### 2. Add a pawaPay config layer

Create backend config support for:

- sandbox base URL
- production base URL
- API token
- callback secret or signature settings
- default currency mapping

Likely files:

- `/C:/Users/user/Documents/TASKs/sokoyetu-backend/src/server.js`
- new config module under `/C:/Users/user/Documents/TASKs/sokoyetu-backend/src/config/`

### 3. Add a pawaPay service module

Create a reusable backend service that handles:

- building deposit requests
- sending bearer-authenticated requests to pawaPay
- generating UUIDv4 `depositId`
- optionally sending signed requests if enabled later
- checking deposit status
- fetching active configuration
- fetching provider availability
- calling predict-provider

Suggested new file:

- `/C:/Users/user/Documents/TASKs/sokoyetu-backend/src/services/pawapayService.js`

### 4. Add payment controller and routes

Create new API endpoints for the app:

- `POST /api/payments/pawapay/deposit`
- `POST /api/payments/pawapay/callback/deposit`
- `GET /api/payments/pawapay/deposit/:depositId`
- optional:
  - `GET /api/payments/pawapay/providers`
  - `POST /api/payments/pawapay/predict-provider`

Suggested new files:

- `/C:/Users/user/Documents/TASKs/sokoyetu-backend/src/controllers/paymentController.js`
- `/C:/Users/user/Documents/TASKs/sokoyetu-backend/src/routes/payments.js`

### 5. Register payment routes

Update:

- `/C:/Users/user/Documents/TASKs/sokoyetu-backend/src/server.js`

Add:

- `app.use('/api/payments', require('./routes/payments'))`

### 6. Rework order creation

Update:

- `/C:/Users/user/Documents/TASKs/sokoyetu-backend/src/controllers/orderController.js`

Change:

- stop setting `payment_status = 'paid'` during order creation
- create the order in a pending payment state
- insert a matching row in `payments` with status `pending`
- only mark the order paid after successful pawaPay callback updates the matching payment row

Suggested order lifecycle:

- `pending_payment` when order is created
- `paid` after deposit callback says `COMPLETED`
- `failed` if deposit fails

### 7. Add callback reconciliation

The callback handler should:

- verify signature headers if enabled
- match the callback to the local payment using `depositId`
- store provider transaction ID in `payments.provider_reference`
- update `payments.status`
- store failure reason in `payments.failure_reason`
- mirror the payment result back to `orders.payment_status`

## Workstream 2: Frontend Checkout

### 1. Update checkout screen

Update:

- `/C:/Users/user/Documents/TASKs/sokoyetu-frontend/src/screens/OrderSummary.js`

Replace the current hardcoded payment block with:

- provider selection
- phone number input
- checkout submission that creates a pawaPay deposit
- status feedback while payment is processing

### 2. Add provider loading to the UI

Frontend should request provider options from the backend rather than hardcoding MTN.

Useful UI states:

- loading providers
- no providers available for this country
- provider prediction result
- payment submitted
- waiting for callback
- payment succeeded
- payment failed

### 3. Update API helpers

Update:

- `/C:/Users/user/Documents/TASKs/sokoyetu-frontend/src/api/index.js`

Add methods for:

- creating a pawaPay deposit
- fetching provider options
- predicting provider
- checking deposit status

### 4. Update order confirmation flow

Current behavior:

- UI shows success immediately after order submission

New behavior:

- UI shows a payment pending state after deposit initiation
- final success screen appears only after backend confirms payment success

## Workstream 3: Status Sync and Reliability

### 1. Add periodic reconciliation

If callbacks are delayed or missed:

- poll pawaPay using `GET /v2/deposits/{depositId}`
- reconcile local order status

### 2. Handle duplicate submissions

Use `depositId` idempotency so:

- retrying the same request does not double-charge
- the backend can safely retry after network issues

### 3. Handle failure codes gracefully

Map pawaPay failures to user-friendly messages:

- invalid phone number
- wrong provider
- insufficient balance
- wallet limit reached
- payment not approved
- provider temporarily unavailable

## Workstream 4: Environment and Secrets

Add environment variables for:

- `PAWAPAY_BASE_URL`
- `PAWAPAY_API_TOKEN`
- `PAWAPAY_CALLBACK_URL`
- `PAWAPAY_SIGNED_REQUESTS_ENABLED`
- `PAWAPAY_SIGNED_CALLBACKS_ENABLED`
- `PAWAPAY_PUBLIC_KEY_ID`

Store them in:

- `/C:/Users/user/Documents/TASKs/sokoyetu-backend/.env`
- `/C:/Users/user/Documents/TASKs/sokoyetu-backend/.env.example`

## Workstream 5: Testing

### 1. Sandbox checkout test

Verify:

- deposit initiation works
- callback updates local order state
- phone number validation behaves correctly
- provider selection works for MTN and Airtel where supported

### 2. Failure-path test

Verify:

- invalid phone number
- unavailable provider
- payment declined
- duplicate deposit request

### 3. Reconciliation test

Verify:

- callback is delayed or missing
- backend status check still resolves the final state

## Suggested Build Order

1. Add schema changes.
2. Create pawaPay service module.
3. Add payment routes and controller.
4. Update order creation to use pending payment state.
5. Add callback handling and reconciliation.
6. Update frontend checkout form.
7. Add provider/status helper methods in the frontend API layer.
8. Test sandbox flow end to end.

## Definition of Done

- Retailer can pay with pawaPay Mobile Money.
- MTN and Airtel are selectable where the account supports them.
- Orders are not marked paid until pawaPay confirms completion.
- Callback handling updates the database correctly.
- Failure cases are visible to the user.
- Sandbox and production are separated through environment configuration.
