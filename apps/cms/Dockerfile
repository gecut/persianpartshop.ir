# syntax=docker/dockerfile:1

# 1. Base Stage
FROM node:22-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914 AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV CI=true
RUN apk add --no-cache libc6-compat
RUN npm install -g pnpm@11.18.0
WORKDIR /app

# 2. Dependencies Stage
FROM base AS deps
WORKDIR /app

# Copy monorepo configuration files and package manifests
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc* ./
COPY packages/contract/package.json ./packages/contract/
COPY apps/api/package.json ./apps/api/
COPY apps/cms/package.json ./apps/cms/
COPY apps/web/package.json ./apps/web/

# Install workspace dependencies using pnpm cache mount
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --store-dir=/pnpm/store

# 3. Builder Stage
FROM deps AS builder
WORKDIR /app

# Copy workspaces needed for CMS
COPY packages/contract ./packages/contract
COPY apps/cms ./apps/cms

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build Payload CMS Next.js Application
RUN pnpm --filter @persianpart/cms build

# 4. Runner Stage (Standardized runtime with pnpm support and zero runtime reinstalls)
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5174
ENV HOST=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1
ENV PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false
ENV NPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false
ENV COREPACK_ENABLE_NETWORK=0

# Create media directory and set app ownership for built-in non-root node user
RUN mkdir -p /app/apps/cms/media /app/apps/cms/.next/cache && \
    chown -R node:node /app

# Copy monorepo workspace files, node_modules, and built CMS artifacts
COPY --from=builder --chown=node:node /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./
COPY --from=builder --chown=node:node /app/.npmrc* ./
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=deps --chown=node:node /app/apps/cms/node_modules ./apps/cms/node_modules
COPY --from=deps --chown=node:node /app/packages/contract/node_modules ./packages/contract/node_modules
COPY --from=builder --chown=node:node /app/packages/contract ./packages/contract
COPY --from=builder --chown=node:node /app/apps/cms ./apps/cms

# Build-time verification gate ensuring pnpm CLI and Payload migrations resolve without network.
# Build-only placeholders satisfy Payload config loading; no real credentials enter the image.
RUN pnpm --version \
    && PAYLOAD_SECRET=build-only-placeholder-not-for-runtime \
       DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build \
       pnpm --filter @persianpart/cms migrate --help > /dev/null

USER node

EXPOSE 5174

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://localhost:' + (process.env.PORT || '5174') + '/admin').then((r) => process.exit(r.status < 500 ? 0 : 1)).catch(() => process.exit(1))"

CMD ["pnpm", "--filter", "@persianpart/cms", "start"]
