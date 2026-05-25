# Radial

Radial is a lightweight issue tracker designed for automation-friendly workflows. It provides a NestJS API backed by Postgres and a Next.js web interface for practical issue management.

## Repository Layout

- `apps/api`: NestJS issue tracker API.
- `apps/web`: Next.js web interface.
- `packages/ui`: Shared UI components.
- `packages/eslint-config`: Shared ESLint configuration.
- `packages/typescript-config`: Shared TypeScript configuration.

## Local Development

Personal development uses a Neon Postgres database and a root `.env.local` file. The API runs on port `3001`, and the web app runs on port `3000`.

### Prerequisites

- Node.js `>=20.19.0`
- pnpm `9.15.9`
- A Neon Postgres connection string for a development database or branch

### Environment

Create a local environment file from the example:

```bash
cp .env.example .env.local
```

Set `DATABASE_URL` in `.env.local` to your Neon development database URL:

```env
DATABASE_URL="postgresql://user:password@ep-example.us-east-1.aws.neon.tech/radial?sslmode=require"
```

Keep `TRACKER_API_KEY` and `TRACKER_API_BASE_URL` aligned so the web app can call the API:

```env
TRACKER_API_KEY="dev-tracker-api-key"
TRACKER_API_BASE_URL="http://localhost:3001/api/v1"
```

Do not commit `.env.local`.

### First Run

Install dependencies, apply migrations to Neon, and start the development servers:

```bash
pnpm install
pnpm db:migrate
pnpm dev
```

Open:

- Web: `http://localhost:3000`
- API health: `http://localhost:3001/api/health`

## Docker

Docker is configured for deployment. The Compose stack runs Postgres, API, Web, and a one-off migration service on one machine.

Copy the production env template and replace all placeholder values:

```bash
cp .env.prod.example .env
```

Build the production images:

```bash
docker compose build
```

Run migrations with Prisma's production migration command:

```bash
docker compose --profile tools run --rm radial-migrate
```

Start the production Postgres, API, and Web containers:

```bash
docker compose up -d
```

The stack does not publish host ports. Attach a reverse proxy or Cloudflare Tunnel container to the `radial-network` Docker network and route traffic to:

- Web: `http://radial-web:3000`
- API: `http://radial-api:3001`

Production uses optimized runtime targets from `Dockerfile`:

- `radial-db`: runs the production Postgres database with data persisted in the `postgres-data` Docker volume.
- `radial-api`: runs the compiled NestJS API with `node dist/src/main.js`.
- `radial-web`: runs the Next.js standalone server with `node server.js`.
- `radial-migrate`: runs `pnpm --filter api db:migrate:deploy` as a one-off migration container.

Set production database and public URLs in `.env`:

```env
API_CONTAINER_PORT=3001
WEB_CONTAINER_PORT=3000
POSTGRES_USER=radial
POSTGRES_PASSWORD=replace-with-a-strong-postgres-password
POSTGRES_DB=radial
DATABASE_URL="postgresql://radial:replace-with-a-strong-postgres-password@radial-db:5432/radial?schema=public"
TRACKER_PUBLIC_URL="https://radial.example.com/api/v1"
TRACKER_API_BASE_URL="http://radial-api:3001/api/v1"
TRACKER_API_KEY="replace-with-a-long-random-production-token"
```

Keep `POSTGRES_PASSWORD` and the password part of `DATABASE_URL` identical.

For a separate Cloudflare Tunnel container, connect it to the Compose network:

```bash
docker network connect radial-network <cloudflared-container-name>
```

Then set the tunnel service target to `http://radial-web:3000`.

### Useful Commands

```bash
pnpm dev          # Start all workspace development tasks
pnpm dev:api      # Start only the API
pnpm dev:web      # Start only the web app
pnpm db:generate  # Generate the Prisma client for the API
pnpm db:migrate   # Apply API migrations to the configured database
pnpm db:migrate:deploy # Apply committed API migrations in production mode
pnpm lint         # Run workspace lint tasks
pnpm typecheck    # Run workspace type checks
pnpm build        # Build the workspace
```
