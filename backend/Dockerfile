# syntax=docker/dockerfile:1
# Gateway image. Built from the repository root (workspace lockfile): docker build -f backend/Dockerfile .

# ------------------------------------------------------------------------------
# Build: compile shared + backend with dev dependencies (TypeScript).
# ------------------------------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app

# Manifests first for layer caching. The mobile manifest is required for npm to resolve the
# workspace set, but only the shared + backend workspaces are installed.
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/
COPY mobile/package.json ./mobile/
RUN npm ci --workspace shared --workspace backend --include-workspace-root=false --ignore-scripts

COPY shared/ ./shared/
COPY backend/ ./backend/
RUN npm --workspace shared run build && npx --workspace backend tsc -p tsconfig.json

# ------------------------------------------------------------------------------
# Runtime: production dependencies of shared + backend only, non-root user.
# ------------------------------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/
COPY mobile/package.json ./mobile/
RUN npm ci --omit=dev --workspace shared --workspace backend --include-workspace-root=false --ignore-scripts \
  && npm cache clean --force

COPY --from=builder --chown=node:node /app/shared/dist ./shared/dist
COPY --from=builder --chown=node:node /app/backend/dist ./backend/dist

USER node
# 8080: public HTTP + WebSocket. 9464: Prometheus metrics (keep off the public load balancer).
EXPOSE 8080 9464

HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:${PORT:-8080}/health || exit 1

CMD ["node", "backend/dist/server.js"]
