# syntax=docker/dockerfile:1
# Multi-stage build for @wapp/admin — separate image from web (SDP-001 §3
# isolation decision: Platform Administration is never bundled with the
# customer-facing deployable).

FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /workspace

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* .npmrc ./
COPY packages ./packages
COPY apps/admin/package.json apps/admin/
RUN pnpm install --frozen-lockfile --filter @wapp/admin...

FROM base AS build
COPY --from=deps /workspace/node_modules ./node_modules
COPY --from=deps /workspace/packages ./packages
COPY --from=deps /workspace/apps/admin/node_modules ./apps/admin/node_modules
COPY . .
RUN pnpm --filter @wapp/admin build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
COPY --from=build --chown=nextjs:nodejs /workspace/apps/admin/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /workspace/apps/admin/.next/static ./apps/admin/.next/static
COPY --from=build --chown=nextjs:nodejs /workspace/apps/admin/public ./apps/admin/public

USER nextjs
EXPOSE 3001
ENV PORT=3001

CMD ["node", "apps/admin/server.js"]
