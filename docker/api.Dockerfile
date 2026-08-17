# syntax=docker/dockerfile:1
# Multi-stage build for @wapp/api (NestJS). Built from the monorepo root context
# so pnpm workspace resolution (workspace:*) works — see docker-compose files
# for the `context: .` + `dockerfile: docker/api.Dockerfile` pairing.


# PHD-001 Volume-3 §20 — bumped from node:20-alpine (previously pinned, but
# never actually built until this volume's Docker runtime verification): the
# root package.json's `packageManager: pnpm@11.20.0` requires Node 22.13+
# (needs the built-in `node:sqlite` module) — `pnpm install` under Corepack
# crashed immediately with `ERR_UNKNOWN_BUILTIN_MODULE` on Node 20.
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /workspace

# ---- Dependencies (cached layer) ----
# PHD-001 Volume-3 §20 — `packages/shared-types` needs its full source +
# tsconfigs present here (not just package.json): the root package.json's
# own `postinstall` (`pnpm --filter @wapp/shared-types build`) runs on every
# `pnpm install`, filtered or not, and previously failed outright in this
# stage — undiscovered until this volume's Docker runtime verification
# actually ran a build (every prior PHD-001 volume verified the running
# application directly, never a full `docker build`).
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* .npmrc tsconfig.base.json ./
COPY packages/shared-types packages/shared-types
COPY packages/config packages/config
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @wapp/api...

# ---- Production-only dependencies (PHD-001 Volume-3 §20) ----
# `deps` above deliberately keeps devDependencies (needed for `tsc`, both
# here and in the `build` stage below); the final `runner` stage previously
# copied that same devDependency-inclusive node_modules wholesale, shipping
# the entire TypeScript/build toolchain into the production image for no
# runtime benefit (confirmed: 889MB -> 313MB node_modules with this fix).
#
# `pnpm prune --prod` (the documented tool for exactly this) was tried twice
# and rejected both times: in this pnpm-workspace layout it deletes
# `apps/api/node_modules`'s own symlinks entirely (not just
# devDependencies), silently breaking `@wapp/api`'s own direct dependencies
# like `@opentelemetry/sdk-node` and leaving the image no smaller at all —
# caught only by actually running the built image, never by the build
# succeeding. Instead: `packages/shared-types`'s already-built `dist/` is
# copied straight from `deps` (skips needing to rebuild it here at all), then
# a single `--prod --ignore-scripts` install resolves `@wapp/api`'s runtime
# deps directly (never installs devDependencies in the first place, so
# nothing needs removing after the fact). `--ignore-scripts` also skips
# bcrypt's native binding compile; `pnpm exec` (not a bare shell `cd`) is
# what correctly puts bcrypt's own resolved `.bin` directory on PATH so
# `node-pre-gyp` is actually found — a bare `cd .../bcrypt && node-pre-gyp
# ...` doesn't have that PATH set up at all, and `pnpm rebuild bcrypt` was
# tried first and silently no-op'd (nothing recorded to "rebuild" when the
# original install never ran the script), both caught only by actually
# running the built image.
FROM base AS prod-deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* .npmrc tsconfig.base.json ./
COPY --from=deps /workspace/packages/shared-types packages/shared-types
COPY packages/config packages/config
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --prod --filter @wapp/api... --ignore-scripts
RUN pnpm exec sh -c 'cd node_modules/.pnpm/bcrypt@*/node_modules/bcrypt && node-pre-gyp install --fallback-to-build'

# ---- Build ----
FROM base AS build
COPY --from=deps /workspace/node_modules ./node_modules
COPY --from=deps /workspace/packages ./packages
COPY --from=deps /workspace/apps/api/node_modules ./apps/api/node_modules
COPY . .
RUN pnpm --filter @wapp/api build

# ---- Production runtime ----
FROM node:22-alpine AS runner
RUN corepack enable && apk add --no-cache dumb-init
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001

# PHD-001 Volume-3 §20 — the workspace's `apps/api/node_modules/**` symlinks
# are RELATIVE (e.g. `../../../../node_modules/.pnpm/@opentelemetry+sdk-node.../...`),
# written assuming the original `/workspace/apps/api/node_modules/...` depth.
# The prior version of this stage flattened `apps/api/dist`/`package.json`
# straight into `/app/`, which breaks every such symlink's `../../` count the
# moment it's copied to a different depth — caught only by actually running
# the built image (`Cannot find module '@opentelemetry/sdk-node'`), never by
# the build itself succeeding. Preserving the exact `apps/api/...` /
# `packages/...` / `node_modules/...` relative layout under /app (instead of
# flattening) keeps every relative symlink's `../../` count correct
# unchanged, since nothing's depth relative to the shared `.pnpm` store moved.
COPY --from=build --chown=nestjs:nodejs /workspace/apps/api/dist ./apps/api/dist
COPY --from=build --chown=nestjs:nodejs /workspace/apps/api/package.json ./apps/api/package.json
COPY --from=prod-deps --chown=nestjs:nodejs /workspace/node_modules ./node_modules
COPY --from=prod-deps --chown=nestjs:nodejs /workspace/packages ./packages
COPY --from=prod-deps --chown=nestjs:nodejs /workspace/apps/api/node_modules ./apps/api/node_modules

# DEP-004 — PM2 manages the Node process in production. dumb-init handles signal
# forwarding correctly for graceful shutdown inside the container.
#
# PHD-001 Volume-3 §20 — must run as root, before `USER nestjs` below: a
# global `npm install -g` writes to /usr/local/lib/node_modules, which the
# unprivileged nestjs user has no permission to create — undiscovered until
# this volume's Docker runtime verification actually ran a build (this
# ordering bug meant the image had never successfully built at all).
RUN npm install -g pm2

USER nestjs
WORKDIR /app/apps/api
EXPOSE 4000

# PHD-001 Volume-3 §20 — was previously absent from every Dockerfile in this
# repo. Uses Node's own http module (no curl/wget added to the minimal
# runtime image) against the version-neutral, unauthenticated /api/health
# endpoint (see HealthController's own doc comment for why that route is
# version-neutral and unauthenticated).
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/api/health',(r)=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["pm2-runtime", "start", "dist/main.js", "--name", "wapp-api"]
