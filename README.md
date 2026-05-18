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

### Useful Commands

```bash
pnpm dev          # Start all workspace development tasks
pnpm dev:api      # Start only the API
pnpm dev:web      # Start only the web app
pnpm db:generate  # Generate the Prisma client for the API
pnpm db:migrate   # Apply API migrations to the configured Neon database
pnpm lint         # Run workspace lint tasks
pnpm typecheck    # Run workspace type checks
pnpm build        # Build the workspace
```
