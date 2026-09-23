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
| `npm start` | Run the server (`node src/server.js`) — applies migrations before listening |
| `npm run dev` | Run with nodemon for auto-reload |
| `npm run db:up` | Start the PostgreSQL container |
| `npm run db:down` | Stop the containers |
| `npm run db:migrate` | Apply pending migrations to the configured database |
| `npm run db:verify` | Check the schema without writing anything |
| `npm test` | Rebuild the test database, then run the whole suite |
| `npm run test:setup` | Only rebuild the test database |
| `npm run test:watch` | Re-run on change |

---

## Backend tests

The backend suite uses Node's built-in test runner, so there is **nothing extra to
install** and no test framework in `package.json`.

```
npm test
```

That rebuilds `sokoyetu_test`, then runs every `tests/*.test.js`. Coverage:

| File | Covers |
| ---- | ------ |
| `auth.test.js` | Registration, sign-in, profile edits, password change, session revocation, sign out everywhere |
| `products.test.js` | Public catalogue, the manufacturer's own listings, create/edit, soft delete and restore |
| `orders.test.js` | Placing an order, stock reservation, both order views, status changes, role guards |
| `rate-limit.test.js` | Sign-in, password-change and sign-out throttling |
| `rate-limit-register.test.js` | Account-creation throttling, kept separate so its exhausted bucket cannot block other files |

### How it stays off your real data

Tests truncate tables, so two independent guards stand between the suite and a real
database:

1. `tests/env.js` refuses to start unless the database name contains `test` and the
   host is not a hosted provider.
2. `tests/helpers.js` re-checks `current_database()` against the live connection
   before every truncate, so a mistake in the environment cannot slip through.

Tests run against `sokoyetu_test` on the same local Postgres as development, so
`npm run db:up` must have been run at least once. Your development database and any
hosted database are never touched.

Two things worth knowing if you add tests:

- **Test files run one at a time** (`--test-concurrency=1`). They share a single
  database, so running them in parallel would have them truncate each other's rows
  mid-test. Node's default is parallel, which is why the flag is there.
- **Rate limits are per-process and in memory.** `tests/env.js` raises the
  IP-keyed limits because every request comes from `127.0.0.1`, and phone numbers
  are unique per test because truncating rows does not clear a limiter's counter.

---

## Frontend tests

```
npm test
```

The frontend suite runs on Jest through `react-scripts test`, using the
`@testing-library/*` packages already listed in `package.json`. 140 tests across
11 files:

| File | Covers |
| ---- | ------ |
| `App.test.js` | The landing page renders, and a signed-out visitor is bounced off protected routes |
| `components/navItems.test.js` | `matchesPath` (exact, sub-path, array, predicate) and the nav invariants — including the guard that the dashboard item does not light up on `/manufacturer/products` |
| `api/index.test.js` | The stored token being attached to requests, and the session-ended signal firing on `SESSION_INVALID` but **not** on a plain 401 |
| `context/AuthContext.test.js` | Restoring a session from a stored token, discarding a rejected one, and dropping the user when the session-ended event fires |
| `screens/RoleSelect.test.js` | The `/` landing page — its copy, features and steps, that a signed-out visitor stays put, that every call to action carries the right `?role=`, and that an already-signed-in visitor is sent straight to their own home |
| `screens/Login.test.js` | Empty-field validation, the role-mismatch guard (a manufacturer's number entered on the retailer form is refused without signing anyone in), Enter-to-submit, and the 429 throttle message |
| `screens/Register.test.js` | Field and password-length validation, both roles' payloads, role-specific labels, and the "phone already registered" message |
| `screens/Account.test.js` | Profile editing, every password-change validation branch, storing the replacement token, the two-step sign-out-everywhere confirm, and the manufacturer-only business profile |
| `screens/OrderSummary.test.js` | The checkout flow — MOQ-stepped quantity, the total including the flat delivery fee, the confirm button's disabled states, phone normalisation (`0788123456` → `250788123456`), country derivation, and each payment outcome. Includes the guard that a **retry reuses the existing order** rather than creating a second one and reserving stock twice |
| `screens/MyProducts.test.js` | Listing management — the live/hidden counts, editing with every validation branch, the trimmed-name and parsed-number payload, and the hide / make-live round trip. Includes the guard that a **failed hide does not flip the badge**, so the list never claims a change the server rejected |
| `screens/AddProduct.test.js` | The three-step wizard — step navigation, the required-field gate, the payload (numbers parsed, blank stock defaulting to 0), the minimum-order-value calculation, the icon preview, and the reset-and-list-another path |

A failed payment deliberately renders its reason in two places — the error box at
the top of the form and the note under the payment status card — so those
assertions match the pair with `findAllByText`. A plain `findByText` throws when
it matches more than one node.

`react-scripts test` watches files by default and never exits, so CI passes
`CI=true` to make it run once and return.

### Two things the runner needs

Both live in code rather than in this document, and both are easy to delete by
accident:

- **`moduleNameMapper` in `package.json`.** CRA 5 ships Jest 27, which ignores the
  `exports` field in a package's `package.json`. `react-router-dom` v7 is
  `exports`-only *and* its `main` points at a `dist/main.js` that is not shipped, so
  Jest could not resolve it at all — the suite failed before running a single test.
  The mapping points Jest straight at the shipped CJS build. Jest 28+ reads
  `exports` itself, so the mapping can go if the runner is ever upgraded.
- **The `TextEncoder`/`TextDecoder` shim in `src/setupTests.js`.** react-router v7
  reads `TextEncoder` while the module is loading, and the jsdom environment CRA
  provides does not define it.

---

## Continuous integration

`.github/workflows/ci.yml` runs on every push to `main` and on every pull request.
It has two independent jobs, so a backend failure and a frontend failure are
reported separately:

| Job | What it does |
| --- | ------------ |
| **Backend tests** | Starts a `postgres:16-alpine` service, runs `npm ci`, then `npm test` — which rebuilds `sokoyetu_test` from `init.sql` plus the migrations, so a broken migration fails the build |
| **Frontend tests and build** | Runs `npm ci`, then `npm test`, then `npm run build` — the build step catches breakage that only shows up at compile time (a bad import, a reference to something that was removed) |

The backend job talks to the service container over `localhost:5432` using the
same credentials the test suite already defaults to (`sokoyetu` / `sokoyetu`,
database `sokoyetu_test`), so no secrets are needed in CI. The safety guards in
`tests/env.js` still apply: the suite refuses to run against anything that is not
a `test`-named database on a non-hosted host.

`concurrency` is set to cancel an in-flight run when a newer commit arrives on the
same branch, so a burst of pushes does not queue up stale builds.

---

## Frontend scripts

| Command | Description |
| ------- | ----------- |
| `npm start` | Development server on port 3000 |
| `npm run build` | Production build into `build/` |
| `npm test` | Test runner — watches for changes by default; set `CI=true` to run once and exit |

---

## API overview

All routes are prefixed with `/api`.

| Area | Endpoints |
| ---- | --------- |
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `PUT /auth/me`, `PUT /auth/password`, `POST /auth/logout-all` |
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

`POST /auth/logout-all` signs the user out of every device on purpose. It uses the same mechanism but
returns **no** replacement token, because the calling device is meant to end up signed out too — the
client is expected to drop its stored token. It does not require the current password: the worst a
caller can do with it is force a sign-in, which is far less severe than the account takeover that
`PUT /auth/password` guards against.

`GET /products` is public and returns only live listings. `GET /products/mine` requires a
manufacturer token and returns **all** of that manufacturer's products, including ones hidden
from retailers, so they can be edited or made live again.

`DELETE /products/:id` is a soft delete: it sets `available = false`, hiding the listing from
retailers without destroying the row or its order history. Restore it with
`PUT /products/:id` and `{ "available": true }`.

Health check: `GET /health` returns `200` when the database is reachable, `503` otherwise.

---

## Database

Schema lives in `sokoyetu-backend/src/db/schema.sql`, covering `users`, `suppliers`, `products`,
`orders`, and `payments`.

### Migrations run on startup

The files in `docker/postgres/migrations/` are applied automatically before the backend opens its
port — `src/db/migrate.js`, called from `src/server.js`. Each applied file is recorded in a
`schema_migrations` table, so a restart reapplies nothing, and the runner then verifies that the
columns the code reads actually exist.

This exists because it used to be a manual step, and that was a live footgun. Shipping a release
that read `users.token_version` against a database nobody had altered by hand meant **every
authenticated request returned a 500** — and nothing in the repo caught it, because migrations were
only ever applied to a brand-new database or by the test setup. Now the schema change and the code
that needs it travel together.

If a migration fails, or the verification does not pass, **the backend refuses to start** rather
than serving traffic against a schema it cannot read. That is deliberate: one loud startup error
beats a stream of 500s.

Three things worth knowing:

- **Applying by hand** — `npm run db:migrate` applies them to whatever `DATABASE_URL` (or the `PG*`
  variables) points at. `npm run db:verify` checks the schema without writing anything.
- **`MIGRATIONS_ON_STARTUP=false`** skips the *applying*, for a database whose user is not allowed
  to run DDL. Verification still runs, so a mismatch still stops the boot.
- **Concurrency is handled without an advisory lock.** Two instances booting at once both try to
  insert the same row in `schema_migrations`; the second blocks, then sees the conflict and skips.
  The claim and the DDL share one transaction, so a migration that fails is rolled back and left
  unrecorded, and the next boot retries it. An advisory lock would not survive a transaction-mode
  connection pooler, which is how hosted Postgres is often reached.

Both migration files are idempotent and safe to re-run. The session-revocation change on its own,
if you would rather apply it directly in the Supabase SQL editor:

```sql
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS token_version integer NOT NULL DEFAULT 0;
```

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

`POST /auth/logout-all` bumps the same column to revoke everything on demand, including the caller.
It returns no replacement token — the client is expected to drop its own.

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
| `POST /auth/logout-all` | 5 / hour | signed-in user id |
| Everything under `/api` | 300 / 15 min | client IP |

Login is keyed on IP *and* phone so that neither one IP spraying many accounts nor many IPs
targeting one account gets through. Successful logins do not count towards the limit, so a
legitimate user signing in on several devices is never locked out. `GET /health` sits outside
`/api` so monitoring is never throttled.

Password changes are keyed on the user rather than the connection, so the limit follows the account
and cannot be reset by switching networks. Only failures count, so a successful change never eats
into the quota.

Sign-out is capped too, because a caller holding a token could otherwise spam it to keep the real
user permanently signed out — a denial of service rather than a compromise, but still worth capping.

Every limit can be tuned without a code change, which is also how the test suite gets out of its own
way: `LOGIN_RATE_LIMIT`, `REGISTER_RATE_LIMIT`, `PASSWORD_RATE_LIMIT`, `LOGOUT_ALL_RATE_LIMIT` and
`API_RATE_LIMIT`. Anything unset, unparseable or non-positive falls back to the default above.

**`TRUST_PROXY_HOPS` matters.** The service runs behind a proxy, so the client IP comes from
`X-Forwarded-For`. Set this to the number of proxy hops (1 for Railway/Vercel, 0 for no proxy).
Getting it wrong breaks rate limiting in one of two ways: too low and every user shares a single
bucket, too high and clients can spoof the header to bypass the limit. Never set it to `true`.

---

## Known gaps

- **Some React screens are still hand-verified** — `RoleSelect`, `Login`, `Register`, `Account`,
  `OrderSummary`, `MyProducts` and `AddProduct` have tests, but `RetailerHome`, `SupplierDetail`,
  `OrderHistory` and `ManufacturerHome` do not.
- **Phone number is not editable** — it is the login identifier, so changing it needs a verified
  flow (confirm the old number, check the new one is free). Name and location are editable from
  the Account screen.
- **No forgotten-password reset** — a signed-in user can change their password from the Account
  screen, but there is no "forgot password" flow. Phone is the login identifier, so recovery needs
  a verified channel: an SMS code to that number, or an admin-triggered reset.
- **Rate limits are per-instance and in-memory** — they reset on restart and are not shared
  across replicas. Fine for a single Railway instance; a multi-instance deployment would need a
  shared store (e.g. Redis).
- **No retailer order cancellation** — retailers can place and pay for orders, but cannot cancel one
  from the UI; only the manufacturer can advance an order's status.
- **The two product forms disagree on what a valid price is** — `MyProducts` rejects a unit price or
  MOQ of `0`, but `AddProduct` accepts them. `AddProduct` tests the raw input string for truthiness
  (`'0'` is truthy) and only parses it afterwards, so a listing priced at zero can be published from
  the wizard and then not edited back to zero from the list. One rule should win.
- **`AddProduct`'s preview hard-codes an "In stock" badge** — it renders regardless of the stock
  figure or whether "Available to order" was switched off, so the preview can promise something the
  published listing will not do.

---

## License

ISC. See [LICENSE](LICENSE).
