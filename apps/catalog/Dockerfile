# syntax=docker/dockerfile:1
FROM node:22-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914 AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV CI=true
WORKDIR /app
RUN apk add --no-cache libc6-compat && npm install -g pnpm@11.18.0

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc* ./
COPY packages/contract/package.json ./packages/contract/
COPY apps/catalog/package.json ./apps/catalog/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --store-dir=/pnpm/store

FROM deps AS builder
COPY packages/contract ./packages/contract
COPY apps/catalog ./apps/catalog
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @persianpart/catalog build \
    && test -f apps/catalog/.next/standalone/apps/catalog/server.js

FROM node:22-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914 AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=5176
ENV HOSTNAME=0.0.0.0
RUN apk add --no-cache libc6-compat
COPY --from=builder --chown=node:node /app/apps/catalog/.next/standalone ./
COPY --from=builder --chown=node:node /app/apps/catalog/.next/static ./apps/catalog/.next/static
COPY --from=builder --chown=node:node /app/apps/catalog/public ./apps/catalog/public
RUN mkdir -p /app/apps/catalog/.next/cache && chown -R node:node /app/apps/catalog/.next
USER node
EXPOSE 5176
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5176)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/catalog/server.js"]
