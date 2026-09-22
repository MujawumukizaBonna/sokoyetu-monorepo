# Run SokoYetu locally

This project uses two separate database options:

- **Docker PostgreSQL** for development on this computer.
- **Supabase PostgreSQL** for a hosted production database.

Use Docker while building and testing. Use Supabase only after the application is ready to deploy.

## 1. Start the local database

Open PowerShell in the `sokoyetu-backend` folder and run:

```powershell
docker compose up -d postgres
docker compose ps
```

The first command downloads PostgreSQL the first time, which may take several minutes. Wait until `docker compose ps` shows `sokoyetu-postgres` with status `running`.

To view database startup messages:

```powershell
docker compose logs -f postgres
```

To stop the database without deleting its data:

```powershell
docker compose down
```

## 2. Use the local database

In `.env`, set these values for local development:

```env
DATABASE_URL=postgresql://sokoyetu:sokoyetu@localhost:5432/sokoyetu
DATABASE_SSL=false
DATABASE_FALLBACK=false
JWT_SECRET=replace_with_a_long_random_value
FRONTEND_URL=http://localhost:3000
PORT=5000
```

The Docker database creates the tables automatically on its first startup.

Start the backend:

```powershell
npm.cmd run dev
```

Start the frontend in a second PowerShell window:

```powershell
cd ..\sokoyetu-frontend
npm.cmd start
```

## 3. Set up Supabase for deployment

1. Create a Supabase project and wait for it to become ready.
2. In Supabase, copy the PostgreSQL connection string from the project's **Connect** page.
3. In the deployment service's backend environment variables, set:

```env
DATABASE_URL=your_supabase_connection_string
DATABASE_SSL=true
DATABASE_FALLBACK=false
JWT_SECRET=a_different_long_random_production_value
FRONTEND_URL=https://your-frontend-domain
```

4. Migrations apply automatically when the backend boots, so there is nothing to run in the Supabase SQL
   editor. Watch the first deploy's logs: the service refuses to start if a migration fails or a required
   column is missing. If the database user is not allowed to run DDL, set `MIGRATIONS_ON_STARTUP=false`
   and apply them yourself with `npm run db:migrate` before deploying.
5. Set the pawaPay production values only when its sandbox payment test passes.

Never put Supabase passwords, JWT secrets, or pawaPay tokens in the frontend project or commit them to Git.
