# syntax=docker/dockerfile:1
#
# ComplianceCore API — multi-stage production image.
# Build context MUST be the repository root (the image needs ../database
# for the raw-SQL migration runner), e.g.:
#   docker build -f backend/Dockerfile -t compliancecore-api .
#
# Debian slim is used instead of Alpine because `bcrypt` (native) and Prisma
# are markedly less fragile against glibc than musl.

# ─── Stage 1: production dependencies only ──────────────────────────────────
FROM node:20-bookworm-slim AS deps
WORKDIR /app/backend
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl python3 make g++ ca-certificates \
 && rm -rf /var/lib/apt/lists/*
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

# ─── Stage 2: build (full deps + TypeScript compile + prisma generate) ──────
FROM node:20-bookworm-slim AS build
WORKDIR /app/backend
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl python3 make g++ ca-certificates \
 && rm -rf /var/lib/apt/lists/*
COPY backend/package.json backend/package-lock.json ./
RUN npm ci
COPY backend/ ./
RUN npx prisma generate
RUN npm run build

# ─── Stage 3: runtime ───────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app/backend

# openssl → Prisma runtime; postgresql-client → in-container backup/restore/psql
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl postgresql-client ca-certificates dumb-init \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --system --uid 1001 --create-home appuser

# Production node_modules (from deps) + generated Prisma client (from build)
COPY --from=deps  /app/backend/node_modules          ./node_modules
COPY --from=build /app/backend/node_modules/.prisma  ./node_modules/.prisma

# Compiled app, Prisma schema, migration/backup scripts, manifest
COPY --from=build /app/backend/dist  ./dist
COPY backend/prisma   ./prisma
COPY backend/scripts  ./scripts
COPY backend/package.json ./package.json

# Raw SQL migrations + seeds live at repo root, outside backend/
COPY database /app/database

USER appuser
EXPOSE 3002

# Container-level liveness probe (Node 20 has global fetch)
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3002)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# dumb-init → correct PID 1 signal handling for graceful shutdown (SIGTERM)
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]
