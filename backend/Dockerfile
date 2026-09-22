# ==============================================================================
# Stage 1: Builder
# ==============================================================================
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package descriptors for caching
COPY shared/package*.json ./shared/
COPY backend/package*.json ./backend/

# Install dependencies and compile shared library
WORKDIR /app/shared
RUN npm install
COPY shared/ ./
RUN npm run build

# Install dependencies and compile backend gateway
WORKDIR /app/backend
RUN npm install
COPY backend/ ./
RUN npm run build

# ==============================================================================
# Stage 2: Production Runner
# ==============================================================================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV HOST=0.0.0.0
ENV FLUSH_INTERVAL_MS=100

# Copy compiled shared package and runtime artifacts
COPY --from=builder /app/shared/package*.json ./shared/
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/shared/node_modules ./shared/node_modules

# Copy compiled backend and production dependencies
COPY --from=builder /app/backend/package*.json ./backend/
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/node_modules ./backend/node_modules

EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

USER node

CMD ["node", "backend/dist/index.js"]
