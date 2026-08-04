# syntax=docker/dockerfile:1
# Multi-stage build for @wapp/web (Next.js 15, standalone output).
# ARG APP selects which Next.js app to build with this same Dockerfile
# (web or admin) — see docker/admin.Dockerfile which reuses this pattern.

FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /workspace

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* .npmrc ./
COPY packages ./packages
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter @wapp/web...

FROM base AS build
COPY --from=deps /workspace/node_modules ./node_modules
COPY --from=deps /workspace/packages ./packages
COPY --from=deps /workspace/apps/web/node_modules ./apps/web/node_modules
COPY . .
RUN pnpm --filter @wapp/web build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
COPY --from=build --chown=nextjs:nodejs /workspace/apps/web/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /workspace/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=nextjs:nodejs /workspace/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000
ENV PORT=3000

CMD ["node", "apps/web/server.js"]
