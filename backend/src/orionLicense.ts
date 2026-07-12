/**
 * ComplianceCore - Orion licensing gate (cloud).
 * ==============================================
 * Product settings are baked in (same for every deployment); to license a
 * deployment you set ONE variable: ORION_LICENSE_KEY.
 *
 * SAFETY (this is a deployed service):
 *   - COMPLETELY OFF unless ORION_LICENSE_KEY is set -> the deployment behaves
 *     exactly as before. Nothing changes until a key is set.
 *   - Validates the license KEY online (cached), and FAILS OPEN on any error or
 *     if OLM is unreachable, so a licensing/network problem can never take the
 *     service down. Only a definitive "revoked / expired / not found" blocks.
 *
 * Zero new dependencies (built-in node:https). Reads process.env directly so it
 * does not depend on the app's validated env schema.
 */
import https from 'node:https';
import { URL } from 'node:url';
import type { Express, Request, Response, NextFunction } from 'express';

const PRODUCT_CODE = process.env.ORION_LICENSE_PRODUCT_CODE ?? 'compliancecore';
const API_URL =
  process.env.ORION_LICENSE_API_URL ??
  'https://olm-api-production-85fe.up.railway.app';
const API_KEY =
  process.env.ORION_LICENSE_API_KEY ??
  'olm_4a771d07.UuyI1X2K8_w460B22kaDB9aVPI71XAt2g3QzSAr2Si8';
const LICENSE_KEY = (process.env.ORION_LICENSE_KEY ?? '').trim();

const CACHE_TTL_MS = 15 * 60 * 1000;
const EXEMPT = ['/health', '/api/license'];

interface LicenseState {
  valid: boolean;
  status: string;
  reason: string | null;
}
let cache: (LicenseState & { at: number }) | null = null;

function olmValidate(timeoutMs = 8000): Promise<LicenseState> {
  return new Promise((resolve, reject) => {
    let u: URL;
    try {
      u = new URL(
        API_URL.replace(/\/+$/, '') + '/api/v1/integration/licenses/validate',
      );
    } catch (e) {
      return reject(e);
    }
    const data = Buffer.from(JSON.stringify({ license_key: LICENSE_KEY }));
    const req = https.request(
      {
        method: 'POST',
        hostname: u.hostname,
        port: u.port || 443,
        path: u.pathname,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length,
          'X-API-Key': API_KEY,
          Accept: 'application/json',
        },
      },
      (res) => {
        let body = '';
        res.on('data', (d) => (body += d));
        res.on('end', () => {
          let j: { valid?: boolean; status?: string; reason?: string } = {};
          try {
            j = JSON.parse(body || '{}');
          } catch {
            /* ignore */
          }
          if (typeof j.valid === 'boolean') {
            resolve({
              valid: j.valid,
              status: j.status ?? (j.valid ? 'active' : 'invalid'),
              reason: j.reason ?? null,
            });
          } else {
            resolve({ valid: true, status: 'unknown', reason: null }); // odd -> fail open
          }
        });
      },
    );
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => req.destroy(new Error('timeout')));
    req.write(data);
    req.end();
  });
}

/** Cached license state. Never throws; fails OPEN on any error / OLM down. */
export async function getState(): Promise<LicenseState> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) return cache;
  try {
    const s = await olmValidate();
    cache = { ...s, at: Date.now() };
    return cache;
  } catch {
    const s: LicenseState = cache
      ? { valid: cache.valid, status: cache.status, reason: cache.reason }
      : { valid: true, status: 'unknown', reason: null };
    cache = { ...s, at: Date.now() };
    return cache;
  }
}

const UNLICENSED_HTML =
  '<!doctype html><meta charset="utf-8"><body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:Segoe UI,Arial;background:#0b1220;color:#fff;text-align:center"><div style="padding:32px;max-width:460px"><h2>ComplianceCore is not licensed</h2><p style="color:#9aa7c7">This deployment does not have a valid license.</p><p style="color:#5f6b8a;font-size:13px">Please contact your administrator (Orion Soft).</p></div></body>';

/**
 * Install the licensing gate, but ONLY if ORION_LICENSE_KEY is set. Returns
 * true if installed, false if it stayed off. Never throws.
 */
export function installOrionGate(app: Express): boolean {
  if (!LICENSE_KEY) {
    // eslint-disable-next-line no-console
    console.log('[orion] licensing OFF (no ORION_LICENSE_KEY) - deployment unchanged');
    return false;
  }
  app.use(async (req: Request, res: Response, next: NextFunction) => {
    try {
      const p = req.path || '/';
      if (p === '/api/license/status') {
        const s = await getState();
        res.json({ valid: s.valid, status: s.status, product: PRODUCT_CODE });
        return;
      }
      if (EXEMPT.some((e) => p === e || p.startsWith(e))) return next();
      const s = await getState();
      if (!s || s.valid) return next(); // licensed OR unknown -> allow (fail open)
      if (p.startsWith('/api/')) {
        res.status(402).json({
          error: {
            code: 'license_' + s.status,
            message: s.reason ?? 'A valid license is required.',
          },
        });
        return;
      }
      res.status(402).type('html').send(UNLICENSED_HTML);
    } catch {
      try {
        return next();
      } catch {
        /* never throw */
      }
    }
  });
  // eslint-disable-next-line no-console
  console.log('[orion] licensing gate ACTIVE for ComplianceCore (fail-open).');
  return true;
}
