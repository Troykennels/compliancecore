# ComplianceCore — Monitoring & Logging

Goal: full visibility with near-zero maintenance. Everything below is either
built-in or a free/low-cost managed add-on — no self-hosted Prometheus/Grafana.

## Health endpoints

| Endpoint | Purpose | Checks |
|---|---|---|
| `GET /health` | Platform healthcheck (Railway `healthcheckPath`) | process up |
| `GET /health/live` | Liveness | process up, never touches deps |
| `GET /health/ready` | Readiness | Postgres + Redis reachable; `503` if degraded |

`/health/ready` is the one to point uptime monitors at — it returns `degraded`
with a per-dependency breakdown when DB or Redis is down.

## Uptime monitoring (external)

Use a free external monitor so you're alerted even if the whole box is down:

- **Better Stack** (Better Uptime) or **UptimeRobot** — free tier.
- Monitor `https://<api-domain>/health/ready` every 1–3 min → email/Slack/SMS alerts.
- Also monitor the Vercel frontend root URL.
- Railway's built-in **Metrics** tab covers CPU/memory/network per service.

## Error tracking (recommended)

Add **Sentry** (generous free tier) for backend exceptions + frontend errors:

```bash
# backend
npm i @sentry/node
```
Initialise at the very top of [`server.ts`](backend/src/server.ts) (before other imports):
```ts
import * as Sentry from '@sentry/node';
if (process.env.SENTRY_DSN) Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.NODE_ENV });
```
The existing global `uncaughtException` / `unhandledRejection` handlers in
`server.ts` already log fatals — Sentry captures them automatically once initialised.
Add `SENTRY_DSN` to the env. Do the same on the frontend with `@sentry/react`.

## Logging

The backend already uses **pino** ([`lib/logger.ts`](backend/src/lib/logger.ts)) —
this is production-correct as-is:

- **Production** → structured JSON to stdout (no `pino-pretty`), level `info`.
- **Development** → pretty colourised output, level `debug`.
- **Secrets are redacted**: `authorization` header, `password`, `passwordHash`, `token`.
- Every request carries an `X-Request-ID` ([`request-id.middleware`](backend/src/middleware)) — include it in bug reports to trace a request end-to-end.

### Where logs go
- **Railway** captures stdout/stderr automatically → **Deployments → Logs** (searchable, last ~7 days).
- For longer retention / alerting on log patterns, ship to a managed sink:
  **Better Stack Logs (Logtail)** or **Datadog** — both ingest JSON directly.
  Railway supports log drains; point one at your provider. No code change needed
  because pino already emits JSON.

### Do / don't
- ✅ Log with `logger.info({ tenantId, ... }, 'message')` — structured fields, not string concatenation.
- ✅ Keep `NODE_ENV=production` so `pino-pretty` (a devDependency) is never required at runtime.
- ❌ Never `console.log` secrets or full request bodies — use the logger so redaction applies.

## Suggested alerts

| Signal | Threshold | Channel |
|---|---|---|
| `/health/ready` down | 2 consecutive failures | Better Stack → email/Slack |
| API 5xx rate | > 2% over 5 min (Sentry) | Sentry alert |
| Redis / Postgres disconnect | any (readiness `degraded`) | uptime monitor |
| Nightly backup workflow | on failure | GitHub Actions email |
| BullMQ job failures | Sentry capture in job catch blocks | Sentry |
