# syntax=docker/dockerfile:1

FROM node:22-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914 AS deps
WORKDIR /app

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV CI=true

RUN apk add --no-cache libc6-compat \
    && npm install -g pnpm@11.18.0

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc* ./
COPY packages/contract/package.json ./packages/contract/
COPY apps/api/package.json ./apps/api/
COPY apps/cms/package.json ./apps/cms/
COPY apps/web/package.json ./apps/web/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM oven/bun:1-alpine@sha256:4cf82f5686b196504fe119db3fcd9185b191f82ece82c40680e597228ec6070a AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5175
ENV HOST=0.0.0.0

COPY --chown=bun:bun --from=deps /app/package.json ./
COPY --chown=bun:bun --from=deps /app/pnpm-workspace.yaml ./
COPY --chown=bun:bun --from=deps /app/node_modules ./node_modules
COPY --chown=bun:bun packages/contract ./packages/contract
COPY --chown=bun:bun apps/cms ./apps/cms
COPY --chown=bun:bun apps/api ./apps/api

RUN mkdir -p /app/media && chown -R bun:bun /app/media

USER bun
EXPOSE 5175

CMD ["bun", "run", "apps/api/src/server.ts"]
