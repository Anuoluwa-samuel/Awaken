# syntax=docker/dockerfile:1.7
# Builds AWAKEN as a standalone Next.js server (see next.config.ts `output: "standalone"`).
# See docs/DEPLOYMENT.md for how this fits into the Oracle Cloud + Caddy setup.

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# `next build` loads src/lib/env.ts at module-evaluation time for some routes, so it needs
# syntactically valid values even though nothing here is reachable at build time. Real values
# come from the running container's env (docker-compose `env_file`), never from this image.
# This stage also doubles as docker-compose.prod.yml's `awaken-tools` service: it's the only
# one with devDependencies and the repo source still present, for `pnpm db:deploy` etc.
ENV NODE_ENV=production \
    DATABASE_URL="postgres://build:build@localhost:5432/build" \
    BETTER_AUTH_SECRET="build-time-placeholder-build-time-placeholder" \
    BETTER_AUTH_URL="http://localhost:3000"
RUN pnpm build

FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
