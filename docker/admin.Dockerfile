# syntax=docker/dockerfile:1
# Multi-stage build for @wapp/admin — separate image from web (SDP-001 §3
# isolation decision: Platform Administration is never bundled with the
# customer-facing deployable).

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /workspace

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* .npmrc tsconfig.base.json ./
COPY packages ./packages
COPY apps/admin/package.json apps/admin/
RUN pnpm install --frozen-lockfile --filter @wapp/admin...

FROM base AS build
COPY --from=deps /workspace/node_modules ./node_modules
COPY --from=deps /workspace/packages ./packages
COPY --from=deps /workspace/apps/admin/node_modules ./apps/admin/node_modules
COPY . .
# PHD-001 Volume-3 §20 — see web.Dockerfile's identical note: Next.js inlines
# NEXT_PUBLIC_* vars into the client bundle at build time, previously absent
# here and undiscovered until this volume's Docker runtime verification.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_ADMIN_APP_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_ADMIN_APP_URL=$NEXT_PUBLIC_ADMIN_APP_URL
RUN pnpm --filter @wapp/admin build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
COPY --from=build --chown=nextjs:nodejs /workspace/apps/admin/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /workspace/apps/admin/.next/static ./apps/admin/.next/static
COPY --from=build --chown=nextjs:nodejs /workspace/apps/admin/public ./apps/admin/public

USER nextjs
EXPOSE 3001
ENV PORT=3001

# PHD-001 Volume-3 §20 — was previously absent. `/login` is middleware.ts's
# own guest-only path (never auth-redirected when unauthenticated), so it
# always returns 200 from a freshly booted container with no session cookie.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/login',(r)=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "apps/admin/server.js"]
