# Hosting ComplianceCore for Free

A practical, no-credit-card-where-possible guide to running the whole stack on
free tiers. Tailored to what this app actually needs:

- **Backend** — Node/Express, **always-on** (7 BullMQ cron workers: reminders,
  escalations, approval deadlines, scheduled reports, billing renewal…)
- **Postgres** — schema-per-tenant, needs the `pgvector` extension (optional but
  the bootstrap tries to create it)
- **Redis** — BullMQ queues + cache + rate limiting
- **Frontend** — static Vite SPA (was on Vercel)
- **Object storage** — S3-compatible, for evidence files
- **AI** — Groq (already free), **Email** — SMTP

---

## TL;DR — recommended 100% free stack

| Layer | Service | Free tier (verify — these change) | Notes |
|-------|---------|-----------------------------------|-------|
| Postgres | **Neon** | 0.5 GB, `pgvector` supported | scales to zero; ~1s cold start |
| Redis | **Upstash** | 500K commands/mo | ⚠️ BullMQ polls — see caveat |
| Backend API | **Koyeb** | 1 always-on nano service | no spin-down → cron works |
| Frontend | **Cloudflare Pages** | unlimited bandwidth | replaces Vercel |
| Storage | **Cloudflare R2** | 10 GB, no expiry | S3-compatible (tiny code tweak) |
| Email | **Brevo** SMTP | 300 emails/day | plug-and-play with nodemailer |
| AI | **Groq** | free | already used |

Alternative backend host: **Render** (free web service) — simpler UI, but it
**spins down after 15 min** of inactivity, which breaks the cron jobs unless you
keep it awake (see the Render section).

---

## 0. Generate your secrets first

You need these env values (same list as `backend/.env.example`). Generate them
once and keep them safe:

```bash
# RSA keypair for JWTs (base64, single-line)
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out jwt_private.pem
openssl rsa -in jwt_private.pem -pubout -out jwt_public.pem
base64 -w0 jwt_private.pem   # -> JWT_PRIVATE_KEY_BASE64
base64 -w0 jwt_public.pem    # -> JWT_PUBLIC_KEY_BASE64

openssl rand -hex 32         # -> ENCRYPTION_KEY (must be 64 hex chars)
openssl rand -hex 32         # -> COOKIE_SECRET
openssl rand -hex 32         # -> SIGNATURE_SECRET
```

---

## 1. Postgres — Neon (free)

1. Sign up at **neon.tech** → create a project (pick a region near your backend).
2. In the SQL editor run: `CREATE EXTENSION IF NOT EXISTS vector;` (Neon supports
   it; the app also degrades gracefully if it's missing).
3. Copy the pooled connection string. Your `DATABASE_URL` should look like:
   ```
   postgresql://USER:PASS@ep-xxx.REGION.aws.neon.tech/DB?sslmode=require&schema=global
   ```
   Keep `schema=global` — the app's global tables live in the `global` schema.

The app runs its own migrations on boot (`scripts/migrate.mjs`), so you don't
create tables by hand.

## 2. Redis — Upstash (free)

1. Sign up at **upstash.com** → create a Redis database (Global or a single
   region near the backend).
2. Copy the **TLS** connection string → `REDIS_URL=rediss://:PASSWORD@HOST:PORT`
   (note `rediss://` with two s's — ioredis needs TLS for Upstash).

⚠️ **BullMQ caveat:** BullMQ workers poll Redis continuously, which burns
commands. On a busy free tier you can hit the monthly command cap. Mitigations:
- It's fine for demo / low-traffic.
- If you hit limits, reduce the number of workers or the cron frequency, or move
  Redis to a small paid instance (Upstash pay-as-you-go is cheap).

## 3. Object storage — Cloudflare R2 (free, S3-compatible)

R2 gives 10 GB free with **no 12-month expiry** (unlike AWS S3's free tier) and
speaks the S3 API. One small code change is required because the app currently
targets AWS's default endpoint.

1. Cloudflare dashboard → **R2** → create a bucket (e.g. `compliancecore-evidence`).
2. Create an R2 **API token** (Access Key ID + Secret).
3. Add an endpoint to the S3 client. In `backend/src/lib/storage.ts`:
   ```ts
   const s3 = new S3Client({
     region: env.AWS_REGION,               // 'auto' for R2
     endpoint: process.env.AWS_S3_ENDPOINT, // https://<accountid>.r2.cloudflarestorage.com
     forcePathStyle: true,
     credentials: {
       accessKeyId: env.AWS_ACCESS_KEY_ID,
       secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
     },
   });
   ```
   Set `AWS_S3_ENDPOINT`, `AWS_REGION=auto`, and the R2 key/secret/bucket in env.
4. Set `OCR_PROVIDER=none` (AWS Textract OCR is not free and is AWS-only).

**Zero-code-change alternative:** use the AWS S3 free tier (5 GB, 12 months) —
works as-is, but needs a card on file and expires.

## 4. Email — Brevo SMTP (free, 300/day)

Sign up at **brevo.com** → SMTP & API → get SMTP credentials:
```
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<your brevo login>
SMTP_PASS=<smtp key>
EMAIL_FROM=ComplianceCore <you@yourdomain>
```

## 5. Backend — Koyeb (free, always-on) ← recommended

Koyeb runs your Docker image with no spin-down, so the cron workers keep firing.

1. Push your branch/PR to GitHub (done).
2. **koyeb.com** → Create Service → GitHub → pick the repo/branch.
3. Builder: **Dockerfile**, path `backend/Dockerfile`, **work dir / context = repo root**
   (the image needs the root `database/` folder for migrations).
4. **Run command — IMPORTANT:** the Dockerfile only starts the server; it does
   NOT migrate. Override the run command to migrate first:
   ```
   sh -c "node scripts/migrate.mjs && node dist/server.js"
   ```
   (This mirrors what `railway.json` / `docker-compose.yml` did.)
5. Instance: **nano (free)**, port **3002**, health check path **`/health`**.
6. Add all env vars (section 0 + Neon + Upstash + R2 + Brevo + `GROQ_API_KEY`)
   plus:
   - `NODE_ENV=production`
   - `PORT=3002`
   - `FRONTEND_URL=https://<your-pages-domain>.pages.dev`  ← needed for CORS
7. Deploy. Note the public URL, e.g. `https://compliancecore-api-xxx.koyeb.app`.

## 6. Frontend — Cloudflare Pages (free)

1. Add SPA routing fallback — create `frontend/public/_redirects`:
   ```
   /*    /index.html   200
   ```
2. **pages.cloudflare.com** → Create project → connect the repo.
3. Build settings:
   - Framework preset: **Vite** (or None)
   - Build command: `npm run build`
   - Build output dir: `dist`
   - Root directory: `frontend`
4. Environment variable:
   - `VITE_API_URL=https://compliancecore-api-xxx.koyeb.app`  (your backend URL,
     **no** trailing `/api` — the client appends `/api`)
5. Deploy → you get `https://<project>.pages.dev`.
6. Go back to the backend and make sure `FRONTEND_URL` matches this exact origin.

---

## ⚠️ The two gotchas that will bite you

### A. Cross-site auth cookies
Frontend (`*.pages.dev`) and backend (`*.koyeb.app`) are **different sites**. The
refresh token is an httpOnly cookie, and browsers only send a cross-site cookie
if it is `SameSite=None; Secure`. Check `backend/src` where the refresh cookie is
set (cookie options) and ensure in production it uses:
```
{ httpOnly: true, secure: true, sameSite: 'none', path: '/' }
```
Both sides are HTTPS on these hosts, so `Secure` is satisfied. If login "works"
but you're logged out on refresh, this is why.

### B. CORS
The API must allow the Pages origin with credentials. Confirm the CORS config
(`backend/src/app.ts`) uses `origin: env.FRONTEND_URL` and `credentials: true`.
Set `FRONTEND_URL` to the exact `https://<project>.pages.dev` (no trailing slash).

---

## Alternative backend: Render (free, but spins down)

Render's free web service sleeps after 15 min idle — which **stops the cron
jobs** while asleep. If you use it anyway:

1. New → **Web Service** → connect repo → Runtime **Docker**, Dockerfile
   `backend/Dockerfile`, root context.
2. Start command: `node scripts/migrate.mjs && node dist/server.js`
3. Health check path: `/health`
4. Add the same env vars as Koyeb.
5. Keep it awake so crons run: create a free monitor at **cron-job.org** or
   **UptimeRobot** hitting `https://<service>.onrender.com/health` every 10
   minutes. Render's free 750 instance-hours/month covers one service 24/7.

---

## Cost summary

Everything above is **$0/month** for demo / light production use. The realistic
first thing you'd outgrow is **Redis command volume** (BullMQ polling) or the
**Neon 0.5 GB** storage cap — both cost only a few dollars to bump when needed.

Groq (AI) and Brevo (email) free tiers are generous; Cloudflare Pages + R2 are
the standouts (effectively unlimited bandwidth, 10 GB storage, no expiry).
