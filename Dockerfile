FROM node:24-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NEXT_TELEMETRY_DISABLED=1

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable \
  && corepack prepare pnpm@9.15.9 --activate

WORKDIR /app

FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json
COPY packages/ui/package.json packages/ui/package.json

RUN pnpm install --frozen-lockfile

FROM deps AS dev

COPY . .

CMD ["pnpm", "dev"]

FROM deps AS builder

COPY . .

ARG DATABASE_URL="postgresql://radial:radial@localhost:5432/radial?schema=public"
ENV DATABASE_URL=$DATABASE_URL

RUN pnpm build

FROM builder AS api-deploy

RUN pnpm --filter api deploy --prod /prod/api
RUN cd /prod/api && /app/apps/api/node_modules/.bin/prisma generate --schema prisma/schema.prisma

FROM base AS api-runner

ENV NODE_ENV=production
ENV PORT=3001

WORKDIR /app

COPY --from=api-deploy --chown=node:node /prod/api ./

USER node

EXPOSE 3001

CMD ["node", "dist/src/main.js"]

FROM builder AS api-migrator

ENV NODE_ENV=production
ENV DATABASE_URL=""

CMD ["pnpm", "--filter", "api", "db:migrate:deploy"]

FROM base AS web-runner

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

WORKDIR /app

COPY --from=builder --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=builder --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static

USER node

EXPOSE 3000

WORKDIR /app/apps/web

CMD ["node", "server.js"]
