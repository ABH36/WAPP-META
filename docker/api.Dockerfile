# syntax=docker/dockerfile:1
# Multi-stage build for @wapp/api (NestJS). Built from the monorepo root context
# so pnpm workspace resolution (workspace:*) works — see docker-compose files
# for the `context: .` + `dockerfile: docker/api.Dockerfile` pairing.

FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /workspace

# ---- Dependencies (cached layer) ----
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* .npmrc ./
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/config/package.json packages/config/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @wapp/api...

# ---- Build ----
FROM base AS build
COPY --from=deps /workspace/node_modules ./node_modules
COPY --from=deps /workspace/packages ./packages
COPY --from=deps /workspace/apps/api/node_modules ./apps/api/node_modules
COPY . .
RUN pnpm --filter @wapp/api build

# ---- Production runtime ----
FROM node:20-alpine AS runner
RUN corepack enable && apk add --no-cache dumb-init
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001
COPY --from=build --chown=nestjs:nodejs /workspace/apps/api/dist ./dist
COPY --from=build --chown=nestjs:nodejs /workspace/apps/api/package.json ./package.json
COPY --from=build --chown=nestjs:nodejs /workspace/node_modules ./node_modules
COPY --from=build --chown=nestjs:nodejs /workspace/packages ./packages

USER nestjs
EXPOSE 4000

# DEP-004 — PM2 manages the Node process in production. dumb-init handles signal
# forwarding correctly for graceful shutdown inside the container.
RUN npm install -g pm2
ENTRYPOINT ["dumb-init", "--"]
CMD ["pm2-runtime", "start", "dist/main.js", "--name", "wapp-api"]
