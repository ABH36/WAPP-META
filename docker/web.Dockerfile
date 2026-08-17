# syntax=docker/dockerfile:1
# Multi-stage build for @wapp/web (Next.js 15, standalone output).
# ARG APP selects which Next.js app to build with this same Dockerfile
# (web or admin) — see docker/admin.Dockerfile which reuses this pattern.

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /workspace

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* .npmrc tsconfig.base.json ./
COPY packages ./packages
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter @wapp/web...

FROM base AS build
COPY --from=deps /workspace/node_modules ./node_modules
COPY --from=deps /workspace/packages ./packages
COPY --from=deps /workspace/apps/web/node_modules ./apps/web/node_modules
COPY . .
# PHD-001 Volume-3 §20 — was previously absent, and undiscovered until this
# volume's Docker runtime verification actually ran a build: Next.js inlines
# NEXT_PUBLIC_* vars into the client bundle at build time, not read at
# runtime like every other env var, so `next build` genuinely needs them
# here (it failed prerendering pages that read `NEXT_PUBLIC_API_URL`
# outright without this). Sourced from docker-compose.prod.yml's `build.args`.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
RUN pnpm --filter @wapp/web build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
COPY --from=build --chown=nextjs:nodejs /workspace/apps/web/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /workspace/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=nextjs:nodejs /workspace/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000
ENV PORT=3000

# PHD-001 Volume-3 §20 — was previously absent. `/` is explicitly listed in
# middleware.ts's own PUBLIC_PATHS (never auth-redirected), so it always
# returns 200 from a freshly booted container with no session cookie.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/',(r)=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "apps/web/server.js"]
