# syntax=docker/dockerfile:1
#
# ComplianceCore frontend — static Vite SPA served by nginx.
# Build context = repo root:  docker build -f frontend/Dockerfile -t compliancecore-web .
#
# NOTE: Vite inlines VITE_* vars at BUILD time, so the API URL must be passed
# as a build arg, not a runtime env var.
ARG VITE_API_URL=http://localhost:3002
ARG VITE_APP_ENV=production
ARG VITE_APP_NAME=ComplianceCore

# ─── Stage 1: build ─────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci
COPY frontend/ ./
ARG VITE_API_URL
ARG VITE_APP_ENV
ARG VITE_APP_NAME
ENV VITE_API_URL=$VITE_API_URL VITE_APP_ENV=$VITE_APP_ENV VITE_APP_NAME=$VITE_APP_NAME
RUN npm run build

# ─── Stage 2: serve ─────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/ >/dev/null 2>&1 || exit 1
CMD ["nginx", "-g", "daemon off;"]
