# SokoYetu

A B2B supply-chain marketplace connecting manufacturers in Kigali with retailers across Rwanda.

Retailers discover suppliers, browse products, and place orders. Manufacturers publish listings, manage stock, and respond to incoming orders. Both roles share one responsive interface with role-specific navigation.

---

## Repository layout

```
TASKs/
├── sokoyetu-backend/    Express 5 + PostgreSQL API (auth, suppliers, products, orders, payments)
└── sokoyetu-frontend/   React 19 single-page app (Create React App)
```

## Tech stack

| Layer    | Stack |
| -------- | ----- |
| Frontend | React 19, react-router-dom 7, axios, Create React App 5 |
| Backend  | Node.js, Express 5, PostgreSQL (`pg`), JWT (`jsonwebtoken`), bcryptjs |
| Payments | pawaPay (mobile money, sandbox by default) |
| Infra    | Docker Compose (PostgreSQL 16 + backend), Railway / Vercel for deployment |

---

## Prerequisites

- Node.js 20 or newer
- Docker Desktop (for the local PostgreSQL instance)
- npm

---

## Getting started

### 1. Start the database

```bash
cd sokoyetu-backend
docker compose up -d postgres
```

The container creates the schema automatically on first startup from `docker/postgres/init.sql`.

### 2. Configure the backend

```bash
cd sokoyetu-backend
cp .env.example .env
```

Then edit `.env`. For local development with the Docker database:

```env
DATABASE_URL=postgresql://sokoyetu:sokoyetu@localhost:5432/sokoyetu
DATABASE_SSL=false
JWT_SECRET=replace_with_a_long_random_value
FRONTEND_URL=http://localhost:3000
PORT=5000
```

`JWT_SECRET` must be a long random string. Never commit `.env` — it is gitignored.

### 3. Run the backend

```bash
cd sokoyetu-backend
npm install
npm run dev        # nodemon, http://localhost:5000
```

Verify it is up: `GET http://localhost:5000/health`

### 4. Configure and run the frontend

```bash
cd sokoyetu-frontend
cp .env.example .env
npm install
npm start          # http://localhost:3000
```

`REACT_APP_API_URL` in the frontend `.env` must point at the backend (`http://localhost:5000` locally).

---

## Backend scripts

| Command | Description |
| ------- | ----------- |
| `npm start` | Run the server (`node src/server.js`) |
| `npm run dev` | Run with nodemon for auto-reload |
| `npm run db:up` | Start the PostgreSQL container |
| `npm run db:down` | Stop the containers |

## Frontend scripts

| Command | Description |
| ------- | ----------- |
| `npm start` | Development server on port 3000 |
| `npm run build` | Production build into `build/` |
| `npm test` | Interactive test runner |

---

## API overview

All routes are prefixed with `/api`.

| Area | Endpoints |
| ---- | --------- |
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `PUT /auth/me`, `PUT /auth/password` |
| Suppliers | `GET /suppliers`, `GET /suppliers/:id`, `GET /suppliers/my`, `PUT /suppliers/my` |
| Products | `GET /products`, `GET /products/mine`, `GET /products/:id`, `POST /products`, `PUT /products/:id`, `DELETE /products/:id` |
| Orders | `POST /orders`, `GET /orders/my`, `GET /orders/incoming`, `PUT /orders/:id/status`, `GET /orders/stats` |
| Payments | `GET /payments/pawapay/providers`, `POST /payments/pawapay/predict-provider`, `POST /payments/pawapay/deposit`, `GET /payments/pawapay/deposit/:id` |

Authentication uses a bearer token: `Authorization: Bearer <jwt>`.

`PUT /auth/me` updates the signed-in user's own `name` and `location`. It deliberately ignores
`phone` (the login identifier, so changing it needs a verified flow), `role` (accepting it would
let any account escalate itself to manufacturer), and `password` (must go through a dedicated
route with the current password and strength rules).

`PUT /auth/password` changes the signed-in user's own password. It requires both `currentPassword`
and `newPassword`, and rejects a new password under 6 characters or one identical to the current
one. The account is taken from the token and never from the body, so passing a `userId` cannot be
used to change someone else's password.

Changing a password **revokes every token issued before it**, which signs the user out everywhere.
The response carries a replacement `token` so the device that made the change stays signed in. See
"Session revocation" under Security notes.

`GET /products` is public and returns only live listings. `GET /products/mine` requires a
manufacturer token and returns **all** of that manufacturer's products, including ones hidden
from retailers, so they can be edited or made live again.

`DELETE /products/:id` is a soft delete: it sets `available = false`, hiding the listing from
retailers without destroying the row or its order history. Restore it with
`PUT /products/:id` and `{ "available": true }`.

Health check: `GET /health` returns `200` when the database is reachable, `503` otherwise.

---

## Database

Schema lives in `sokoyetu-backend/src/db/schema.sql`, covering `users`, `suppliers`, `products`, `orders`, and `payments`.

For hosted PostgreSQL (Supabase), set `DATABASE_SSL=true` and apply the migrations in
`docker/postgres/migrations/` through the SQL editor:

- `001_checkout_hardening.sql`
- `002_session_revocation.sql` — adds `users.token_version`. **Apply this before deploying the code
  that reads it**, otherwise every authenticated request will fail. Both files are idempotent and
  safe to re-run.

See `sokoyetu-backend/LOCAL_DEVELOPMENT.md` for the full local and deployment walkthrough, and `sokoyetu-backend/DEPLOYMENT_CHECKLIST.md` before shipping.

---

## Security notes

- `.env` files are gitignored and must stay that way. Only `.env.example` files are committed.
- Rotate `JWT_SECRET` between development and production.
- Keep pawaPay sandbox credentials out of the frontend entirely.
- Signed pawaPay requests and callbacks are implemented but disabled by default
  (`PAWAPAY_SIGNED_REQUESTS_ENABLED=false`). Enable them only after configuring `PAWAPAY_PUBLIC_KEY_ID`.
- `PUT /auth/me` only accepts `name` and `location`. It ignores `role`, `password` and `phone`,
  so it cannot be used to escalate privileges or bypass the password rules.
- `PUT /auth/password` requires the current password even though the caller already holds a valid
  token. Without that check, a stolen token would be enough to set a new password and lock the real
  owner out of their account.
- Password rules are enforced server side as well as in the form, so posting straight to the API
  cannot get around the 6 character minimum.

### Session revocation

Tokens are stateless JWTs, so they cannot be un-issued. Revocation works by version instead: each
token records the `token_version` it was minted with, and `authMiddleware` compares that against
`users.token_version`, rejecting any token that no longer matches.

Changing a password increments the column, which signs the user out of every other device. The
change request itself is holding a token that was just invalidated, so the endpoint returns a fresh
one for the device that made the change.

A 401 that means "this session is over" carries `"code": "SESSION_INVALID"`. The frontend keys off
that code to clear the stored token and return to sign-in. A 401 **without** the code is an ordinary
failed attempt — a wrong current password, a wrong sign-in — and deliberately does not sign anyone
out. Without that distinction, mistyping your password would log you out.

The cost is one primary-key lookup per authenticated request, which is the price of being able to
revoke a stateless token at all. Tokens issued before `token_version` existed carry no version and
are treated as `0`, which is the column default, so deploying this does not sign out existing users.

### Rate limiting

Throttling is applied with `express-rate-limit`. Exceeding a limit returns
`429` with the same `{ "error": "..." }` shape as the rest of the API.

| Scope | Limit | Keyed on |
| ----- | ----- | -------- |
| `POST /auth/login` | 10 failures / 15 min | client IP **+** submitted phone |
| `POST /auth/register` | 5 / hour | client IP |
| `PUT /auth/password` | 5 failures / 15 min | signed-in user id |
| Everything under `/api` | 300 / 15 min | client IP |

Login is keyed on IP *and* phone so that neither one IP spraying many accounts nor many IPs
targeting one account gets through. Successful logins do not count towards the limit, so a
legitimate user signing in on several devices is never locked out. `GET /health` sits outside
`/api` so monitoring is never throttled.

Password changes are keyed on the user rather than the connection, so the limit follows the account
and cannot be reset by switching networks. Only failures count, so a successful change never eats
into the quota.

**`TRUST_PROXY_HOPS` matters.** The service runs behind a proxy, so the client IP comes from
`X-Forwarded-For`. Set this to the number of proxy hops (1 for Railway/Vercel, 0 for no proxy).
Getting it wrong breaks rate limiting in one of two ways: too low and every user shares a single
bucket, too high and clients can spoof the header to bypass the limit. Never set it to `true`.

---

## Known gaps

- **No automated tests** — the default Create React App test files remain. The auth and product
  flows were verified manually against a local database, but nothing runs in CI.
- **No CI** — builds and linting are not automated.
- **Phone number is not editable** — it is the login identifier, so changing it needs a verified
  flow (confirm the old number, check the new one is free). Name and location are editable from
  the Account screen.
- **No forgotten-password reset** — a signed-in user can change their password from the Account
  screen, but there is no "forgot password" flow. Phone is the login identifier, so recovery needs
  a verified channel: an SMS code to that number, or an admin-triggered reset.
- **No "sign out everywhere" button** — changing a password revokes other sessions, but there is no
  standalone action for a user who wants to drop other devices without changing their password. The
  mechanism already exists (`token_version`); it just needs an endpoint and a button.
- **Rate limits are per-instance and in-memory** — they reset on restart and are not shared
  across replicas. Fine for a single Railway instance; a multi-instance deployment would need a
  shared store (e.g. Redis).
- **No retailer order cancellation** — retailers can place and pay for orders, but cannot cancel one
  from the UI; only the manufacturer can advance an order's status.

---

## License

ISC. See [LICENSE](LICENSE).
