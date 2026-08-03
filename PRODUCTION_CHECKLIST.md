# ComplianceCore — Production Readiness Checklist

Backend runs on **Railway** (service `compliancecore-api`), frontend on **Vercel**.
Both deploy from `main` via [`deploy.yml`](.github/workflows/deploy.yml), and only
after CI passes — a red build never reaches production.

**Start here, and re-run after every change:**

```bash
cd backend && npm run preflight
```

It validates behaviour rather than presence — calls Groq and Paystack for real,
checks migrations are applied, confirms the framework control library is seeded,
and verifies every tenant schema has the newest tables. Exits non-zero on
anything blocking. Secrets are never printed, only a length and a short
fingerprint, so two environments can be compared safely.

## 🔴 Blockers (must fix before deploy)

- [ ] `npm run preflight` reports **0 blocking**.
- [ ] All secrets set in Railway → Variables — no placeholders.
- [ ] JWT keypair, `ENCRYPTION_KEY`, `COOKIE_SECRET`, `SIGNATURE_SECRET` generated
      fresh for prod (never reuse dev values). Rotating `SIGNATURE_SECRET` later
      invalidates every existing e-signature.
- [ ] **`NODE_ENV=production`** — cookies are only marked `Secure` / `SameSite=None`
      outside development, so cross-site auth silently breaks without it.
- [ ] **`ENABLE_REDIS` is NOT set to `false`.** It is a local-development escape
      hatch: rate limits become per-process, the cache becomes in-memory, and
      **every background job stops** — reminders, escalations, renewals,
      scheduled reports and score snapshots.
- [ ] `FRONTEND_URL` (API) and `VITE_API_URL` (frontend) point at the real deployed
      domains. **No trailing slash on `FRONTEND_URL`** — CORS matching is exact.
- [ ] `BREVO_API_KEY` set. **Railway blocks outbound SMTP**, so `SMTP_HOST` alone
      will time out and no verification or receipt email will ever arrive.
- [ ] Framework control library seeded (`npm run db:seed`). If
      `framework_data.framework_controls` is empty, adopting a framework silently
      creates nothing.
- [ ] `BILLING_NOTIFY_EMAIL` set to a company address, not a personal one —
      otherwise revenue mail follows whoever currently holds superadmin.

## 💳 Payments (Paystack)

- [ ] `PAYSTACK_PUBLIC_KEY` (`pk_live_…`) and `PAYSTACK_SECRET_KEY` (`sk_live_…`) set.
      The secret key goes straight into Railway — never into source, chat or a ticket.
- [ ] `PAYMENT_CURRENCIES=NGN`. Add `USD` **only** once Paystack confirm it is
      enabled on your merchant account; until then a USD checkout fails with
      *"Currency not supported by merchant"*, surfaced verbatim to the customer.
- [ ] **Webhook registered** at Paystack → Settings → API Keys & Webhooks:
      `https://<railway-domain>/api/payments/webhook/paystack`
      (domain is under Railway → Service → Settings → Networking → Public Domain).
      Easy to skip and it quietly costs money: payment completes via the browser
      redirect, but if the customer closes the tab straight after paying, the
      webhook is the only thing that grants their plan.
- [ ] Test payment verified end to end — confirm it in Paystack's **webhook
      delivery log**, not just by seeing the redirect succeed.

## 🗄️ Database migrations

The Railway start command runs both on every boot; each is idempotent:

```
node scripts/migrate.mjs && node scripts/migrate-tenants.mjs && node dist/server.js
```

They do different jobs, and the second is easy to forget:

- `migrate.mjs` — the **global** schema (plus seeds with `--seed`).
- `migrate-tenants.mjs` — applies `database/tenant-template/*` to tenants that
  **already exist**. Provisioning only covers new signups, so without it a newly
  added per-tenant table is missing for every current customer, and the feature
  needing it returns 500 for exactly the people already paying.

- [ ] Both ran clean on the first production boot (check the deploy logs).

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
- [ ] First deploy smoke test — walk the **real customer journey**, not just page
      loads: register → verify email → create organisation → scoping questionnaire
      → adopt a framework → controls appear → subscribe → pay → receipt arrives.
      Page-level checks miss the create/update paths, which is where breakage hides.

## ⚠️ Known gaps

Written down so nobody discovers them in front of a customer:

- **SSO** — the settings page exists, the feature does not. Enterprise buyers ask early.
- **Calendar grid** groups events by browser-local date, so an event near midnight
  can land on the wrong cell for a user in another timezone. Every other date in
  the app renders in the organisation's own timezone.
- **Test coverage is thin** — 11 unit plus 5 integration tests. CI does run the
  integration suite against a real Postgres service, but coverage is far from
  complete.
- **Incidents** is new: its per-tenant table only exists once `migrate-tenants.mjs`
  has run.
- [ ] Custom domains + HTTPS on both API (Railway) and web (Vercel).
- [ ] Email deliverability tested (verification + reminder emails land, not spam).
- [ ] Rollback plan: Railway keeps prior deploys — know how to redeploy the last good one.
- [ ] On-call / alert routing decided (who gets the Better Stack + Sentry alerts).
