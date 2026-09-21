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
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `PUT /auth/me` |
| Suppliers | `GET /suppliers`, `GET /suppliers/:id`, `GET /suppliers/my`, `PUT /suppliers/my` |
| Products | `GET /products`, `GET /products/mine`, `GET /products/:id`, `POST /products`, `PUT /products/:id`, `DELETE /products/:id` |
| Orders | `POST /orders`, `GET /orders/my`, `GET /orders/incoming`, `PUT /orders/:id/status`, `GET /orders/stats` |
| Payments | `GET /payments/pawapay/providers`, `POST /payments/pawapay/predict-provider`, `POST /payments/pawapay/deposit`, `GET /payments/pawapay/deposit/:id` |

Authentication uses a bearer token: `Authorization: Bearer <jwt>`.

`PUT /auth/me` updates the signed-in user's own `name` and `location`. It deliberately ignores
`phone` (the login identifier, so changing it needs a verified flow), `role` (accepting it would
let any account escalate itself to manufacturer), and `password` (must go through a dedicated
route with the current password and strength rules).

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

For hosted PostgreSQL (Supabase), set `DATABASE_SSL=true` and apply `docker/postgres/migrations/001_checkout_hardening.sql` in the SQL editor.

See `sokoyetu-backend/LOCAL_DEVELOPMENT.md` for the full local and deployment walkthrough, and `sokoyetu-backend/DEPLOYMENT_CHECKLIST.md` before shipping.

---

## Security notes

- `.env` files are gitignored and must stay that way. Only `.env.example` files are committed.
- Rotate `JWT_SECRET` between development and production.
- Keep pawaPay sandbox credentials out of the frontend entirely.
- Signed pawaPay requests and callbacks are implemented but disabled by default
  (`PAWAPAY_SIGNED_REQUESTS_ENABLED=false`). Enable them only after configuring `PAWAPAY_PUBLIC_KEY_ID`.

---

## Known gaps

- **No automated tests** — the default Create React App test files remain; no coverage of real flows.
- **No CI** — builds and linting are not automated.
- **Phone number is not editable** — it is the login identifier, so changing it needs a verified
  flow (confirm the old number, check the new one is free). Name and location are editable from
  the Account screen.
- **No password change or reset** — there is no change-password route and no recovery flow.
- **No login rate limiting** — `POST /auth/login` is not throttled or lockout-protected.
- **No retailer order cancellation** — retailers can place and pay for orders, but cannot cancel one
  from the UI; only the manufacturer can advance an order's status.

---

## License

ISC. See [LICENSE](LICENSE).
