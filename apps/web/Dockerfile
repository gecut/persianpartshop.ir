# syntax=docker/dockerfile:1

# 1. Base Stage
FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV CI=true
RUN npm install -g pnpm@11.18.0

# 2. Builder Stage
FROM base AS builder
WORKDIR /app

# Copy monorepo configurations and manifests for caching
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc* ./
COPY packages/contract/package.json ./packages/contract/
COPY apps/api/package.json ./apps/api/
COPY apps/cms/package.json ./apps/cms/
COPY apps/web/package.json ./apps/web/

# Install workspace dependencies with cache mount
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# Copy source code across dependent workspaces
COPY packages/contract ./packages/contract
COPY apps/api ./apps/api
COPY apps/cms ./apps/cms
COPY apps/web ./apps/web

# Build arguments for frontend API endpoint configuration
ARG VITE_API_URL=https://api.persianpart.shop
ENV VITE_API_URL=$VITE_API_URL

# Build web application
RUN pnpm --filter @persianpart/web build

# 3. Runner Stage
FROM ghcr.io/gecut/nginx/spa:1.0.0@sha256:62b6611c01e5103aa5e72b0cab9b96cbe2112bd06a89f47c65297c56e88ae15c AS runner

COPY --chown=nginx:nginx --from=builder /app/apps/web/dist /data
