# ComplianceCore — Deployment Guide

## Recommendation at a glance

| Concern | Choice | Why |
|---|---|---|
| **Backend + workers** | **Railway** (Docker service) | The API and all BullMQ cron workers run **in one persistent process** ([`server.ts`](backend/src/server.ts)). This needs an always-on container — **Vercel serverless cannot host it** (no long-lived process, no in-process cron, execution timeouts). |
| **PostgreSQL 16** | Railway Postgres plugin | Managed, auto-injected `DATABASE_URL`, daily managed backups. One dashboard. |
| **Redis** | Railway Redis plugin | Managed, auto-injected `REDIS_URL`. Needed for cache + BullMQ. |
| **Frontend** | **Vercel** | Static Vite SPA — free tier, zero-config, global CDN, atomic deploys. |

> **Why not "just Vercel for everything"?** The backend is a stateful, always-on
> Express server with seven in-process scheduled workers and live Postgres/Redis
> connections. Serverless functions are the wrong shape. Railway gives you a
> long-running container with managed DB + Redis attached, which is the lowest-ops
> option that actually fits this architecture.
>
> **Want a single dashboard?** You can also host the frontend on Railway (use
> `frontend/Dockerfile`). Vercel is only recommended because it's free and simpler
> for a static SPA.

---

## ⚠️ Pre-flight blocker: TypeScript build

`npm run build` currently fails — the backend has **267 pre-existing type errors**
across most modules. The app runs in development only because `tsx` transpiles
without type-checking. **Before the Docker/Railway/CI build can go green, this must
be resolved.** See [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md) → "Build must pass".

---

## One-time setup

### 1. Generate secrets
```bash
# JWT RS256 keypair
openssl genrsa -out private.key 2048
openssl rsa -in private.key -pubout -out public.key
base64 -w 0 private.key   # -> JWT_PRIVATE_KEY_BASE64   (macOS: base64 -i private.key)
base64 -w 0 public.key    # -> JWT_PUBLIC_KEY_BASE64

openssl rand -hex 32      # -> ENCRYPTION_KEY
openssl rand -hex 32      # -> COOKIE_SECRET
```

### 2. Backend on Railway
1. Create a project → **New → Deploy from GitHub repo**.
2. Add the **PostgreSQL** and **Redis** plugins (they inject `DATABASE_URL` / `REDIS_URL`).
3. The service picks up [`railway.json`](railway.json): it builds `backend/Dockerfile`
   and runs `node scripts/migrate.mjs && node dist/server.js` — migrations apply on
   every deploy, then the API starts.
4. Set all variables from [`backend/.env.production.example`](backend/.env.production.example)
   in **Service → Variables** (except `DATABASE_URL`/`REDIS_URL`, injected by the plugins).
5. Set the service name to `compliancecore-api` (matches the deploy workflow).
6. First deploy: run seeds once — `railway run npm run db:seed` (loads `database/seeds/frameworks.sql`).

### 3. Frontend on Vercel
1. **Import Project** → point at the repo, set **Root Directory = `frontend`**.
2. Vercel auto-detects Vite; [`frontend/vercel.json`](frontend/vercel.json) handles SPA routing + caching.
3. Add env var `VITE_API_URL = https://<your-railway-api-domain>` (Production).
4. Deploy. Then set the API's `FRONTEND_URL` to the Vercel domain so **CORS** allows it.

### 4. Wire CI/CD (optional but recommended)
Add these GitHub repo secrets, then pushes to `main` auto-deploy via
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml):

| Secret | Where |
|---|---|
| `RAILWAY_TOKEN` | Railway → Project → Tokens |
| `VERCEL_TOKEN` | Vercel → Account → Tokens |
| `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` | run `vercel link` locally → `.vercel/project.json` |

---

## Local production-like run

```bash
cp .env.docker.example .env      # fill in secrets
docker compose up --build        # postgres + redis + api (migrates) + web(nginx)
# API  -> http://localhost:3002/health
# Web  -> http://localhost:8080
```

---

## Migrations & schema bootstrap

Two layers of schema:

- **Global tables** (`users`, `tenants`, `tenant_memberships`, `sessions`,
  `mfa_credentials`, `api_keys`, `webhooks`, …) are owned by the **Prisma schema**
  (`backend/prisma/schema.prisma`, `schemas = ["global","framework_data"]`).
  [`backend/scripts/migrate.mjs`](backend/scripts/migrate.mjs) applies the global
  raw-SQL migrations in [`database/migrations/`](database/migrations) (extensions,
  roles, indexes; tracked in `global.schema_migrations` by version) and runs
  `prisma db push` to create/sync the Prisma-owned global tables. `prisma migrate`
  (the migration-history workflow) is **not** used — `db push` is.
- **Per-tenant tables** (branches, departments, evidence, controls, calendar,
  approvals, tasks, …) are templates in
  [`database/tenant-template/`](database/tenant-template) using a `{{SCHEMA}}`
  placeholder. They are applied per tenant by the provisioning service
  ([`backend/src/lib/provisioning.ts`](backend/src/lib/provisioning.ts)) when an
  organization is created (`POST /api/organizations`), which creates the
  `tenant_{uuid}` schema and runs each template with `{{SCHEMA}}` substituted.

Postgres must have the `vector` extension available — use an image such as
`pgvector/pgvector:pg16` (the local `docker-compose.yml` already does).

```bash
npm run db:migrate     # apply global migrations + prisma db push
npm run db:seed        # apply database/seeds/*.sql (idempotent seeds only)
```

To add a migration: drop a new `NNN_description.sql` in `database/migrations/`
(zero-padded, next number). It applies automatically on the next deploy.

---

## Scaling path (when you outgrow one box)

The current design runs API + workers in one process — perfect up to moderate load.
When you need to scale the API horizontally, **split the workers into their own
service** first, otherwise every API replica would run the cron jobs, firing
duplicate reminders/snapshots.

Recommended evolution:
1. Add an env flag (e.g. `ROLE=api|worker|all`, default `all`) and gate the
   `start*Worker()` calls in [`server.ts`](backend/src/server.ts) on it.
2. Deploy a second Railway service from the same image with `ROLE=worker` and
   `numReplicas: 1`; set the API service to `ROLE=api` and scale its replicas freely.
3. Put a managed Postgres with read replicas behind heavy dashboard queries.
4. Move S3 to a CDN (CloudFront) for evidence downloads.

This keeps day-1 ops trivial while leaving a clean, well-understood road to scale.
