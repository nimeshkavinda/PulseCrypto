# ==============================================================================
# Stage 1: Builder
# ==============================================================================
FROM node:22-alpine AS builder

WORKDIR /app

# Optimize layer caching: copy workspace package manifests first
COPY package*.json ./
COPY shared/package*.json ./shared/
COPY backend/package*.json ./backend/
COPY mobile/package*.json ./mobile/

# Clean install all dependencies (including devDependencies for build tools)
RUN npm ci

# Copy application source trees
COPY shared/ ./shared/
COPY backend/ ./backend/

# Compile TypeScript packages
RUN npm --prefix shared run build
RUN npm --prefix backend run build

# ==============================================================================
# Stage 2: Production Runner
# ==============================================================================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV HOST=0.0.0.0
ENV FLUSH_INTERVAL_MS=100

# Install production dependencies only (never copy node_modules across stages)
COPY package*.json ./
COPY shared/package*.json ./shared/
COPY backend/package*.json ./backend/
COPY mobile/package*.json ./mobile/

RUN npm ci --omit=dev

# Copy compiled JavaScript bundles and type definitions from builder
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/backend/dist ./backend/dist

# Secure ownership for unprivileged node user
RUN chown -R node:node /app

EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

USER node

CMD ["node", "backend/dist/server.js"]
