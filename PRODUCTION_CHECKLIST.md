# ComplianceCore — Production Readiness Checklist

Work top-to-bottom. Anything unchecked in **Blockers** must be done before go-live.

## 🔴 Blockers (must fix before deploy)

- [ ] **Build must pass.** `cd backend && npm run build` currently fails with **267
      pre-existing TypeScript errors** across ~19 modules. `tsx` hides these in dev;
      `tsc` (the production build) does not. Options:
      1. **Fix the type errors** (correct, recommended — do it module by module).
      2. **Ship transpile-only** (pragmatic): switch `build` to esbuild/swc so the
         emitted JS matches what `tsx` already runs in dev, and keep `type-check`
         as a non-blocking CI gate to burn the errors down over time.
- [ ] `npm ci` in `backend/` after adding the `pg` dependency (used by the migration runner).
- [ ] All secrets set in Railway (see `backend/.env.production.example`) — no placeholders.
- [ ] JWT keypair, `ENCRYPTION_KEY`, `COOKIE_SECRET` generated fresh for prod (never reuse dev values).
- [ ] `FRONTEND_URL` (API) and `VITE_API_URL` (frontend) point at the real deployed domains.
- [ ] `database/seeds/frameworks.sql` loaded once (`npm run db:seed`).

## 🟠 Security

- [ ] `helmet` enabled (already in [`app.ts`](backend/src/app.ts)) ✔
- [ ] CORS locked to `FRONTEND_URL` only (already) ✔ — verify it's the prod domain, not `localhost`.
- [ ] `trust proxy` set for Railway (already) ✔
- [ ] httpOnly + secure cookies confirmed in production (cross-site auth over HTTPS).
- [ ] Rate limiting (`express-rate-limit`) applied to auth routes — verify limits are sane for prod.
- [ ] S3 bucket is **private**; evidence served only via presigned URLs. Bucket has SSE enabled.
- [ ] Separate AWS IAM user for backups with least-privilege (S3 put/list on backup bucket only).
- [ ] No secrets committed — root [`.gitignore`](.gitignore) covers `.env`, `*.key`, `*.pem`, `*.dump`.
- [ ] MFA secrets encrypted at rest with `ENCRYPTION_KEY` (already) ✔

## 🟡 Data & backups

- [ ] Railway managed Postgres backups enabled.
- [ ] Nightly S3 backup workflow live ([`.github/workflows/backup.yml`](.github/workflows/backup.yml)) with secrets set.
- [ ] **Restore tested** at least once (`backend/scripts/restore.sh` against a throwaway DB) — an untested backup is not a backup.
- [ ] Migration runner verified idempotent (re-run `npm run db:migrate` → "0 new migrations").

## 🟢 Observability

- [ ] `/health/ready` wired into an external uptime monitor (Better Stack / UptimeRobot).
- [ ] Railway metrics reviewed; alerts configured (see [MONITORING.md](MONITORING.md)).
- [ ] Sentry (or equivalent) capturing backend + frontend errors.
- [ ] Log drain configured if >7-day log retention is required.

## 🔵 Reliability & performance

- [ ] Graceful shutdown verified (SIGTERM drains HTTP, closes DB/Redis) — already in [`server.ts`](backend/src/server.ts) ✔
- [ ] `dumb-init` PID-1 signal handling in the container (already in Dockerfile) ✔
- [ ] Single worker replica confirmed (`numReplicas: 1`) so cron jobs don't double-fire.
      Before scaling the API, split workers into a separate service (see DEPLOYMENT.md → Scaling path).
- [ ] Redis `maxmemory-policy` reviewed (cache eviction vs. BullMQ persistence).
- [ ] DB connection pool sized for Railway plan (Prisma `connection_limit`).
- [ ] Frontend assets cached (immutable `/assets/*`, no-cache `index.html`) — already in `vercel.json` / `nginx.conf` ✔

## 🚀 Launch & post-launch

- [ ] CI green on `main` ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)).
- [ ] First deploy smoke test: register → login → MFA → upload evidence → dashboard loads.
- [ ] Custom domains + HTTPS on both API (Railway) and web (Vercel).
- [ ] Email deliverability tested (verification + reminder emails land, not spam).
- [ ] Rollback plan: Railway keeps prior deploys — know how to redeploy the last good one.
- [ ] On-call / alert routing decided (who gets the Better Stack + Sentry alerts).
