import { prisma } from '../config/database';
import { AppError } from './errors';

// ─── Organisation branding for EVERY plan (prompt section 11) ───────────────
//
// Legal name, logo, address and contact, footer line and an optional
// letterhead image, applied to the documents ComplianceCore actually produces:
// the executive report PDF, policy and compliance-record downloads, and the
// "Bill to" block of invoices (the invoice itself stays ORION SOFT's).
// ComplianceCore attribution is kept on every document.
//
// Images are stored as checked data (PNG or JPEG only, the formats PDFs can
// embed), never fetched from a URL at print time: no SVG, no script, no
// server-side requests to addresses a customer chooses. Branding is always
// read for the signed-in organisation only, never from a client-supplied id.

// 350 KB keeps one image (base64) well inside the 1 MB request limit; the page
// saves the logo and the letterhead separately.
export const MAX_IMAGE_BYTES = 350 * 1024;
const DATA_URL = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/;
const HEX = /^#[0-9a-fA-F]{6}$/;

export interface Branding {
  name: string;
  legalName: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  footer: string | null;
  color: string | null;
  logo: string | null;
  letterhead: string | null;
}

export async function initBrandingColumns(): Promise<void> {
  await prisma.$executeRawUnsafe(`ALTER TABLE global.tenants
    ADD COLUMN IF NOT EXISTS legal_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS footer_text VARCHAR(300),
    ADD COLUMN IF NOT EXISTS brand_color VARCHAR(7),
    ADD COLUMN IF NOT EXISTS brand_logo TEXT,
    ADD COLUMN IF NOT EXISTS letterhead_image TEXT`);
}

/** The image's real bytes must be the type it claims (a renamed SVG or script is refused). */
export function checkImage(value: unknown, label: string): string | null {
  if (value === null || value === undefined || value === '') return null;
  const m = DATA_URL.exec(String(value));
  if (!m) throw new AppError(`${label} must be a PNG or JPEG image.`, 400, 'VALIDATION_ERROR');
  const bytes = Buffer.from(m[2], 'base64');
  if (bytes.length > MAX_IMAGE_BYTES) throw new AppError(`${label} must be under ${MAX_IMAGE_BYTES / 1024} KB.`, 400, 'VALIDATION_ERROR');
  const png = bytes.length > 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const jpeg = bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if ((m[1] === 'png' && !png) || (m[1] === 'jpeg' && !jpeg)) {
    throw new AppError(`${label} is not a real ${m[1].toUpperCase()} image.`, 400, 'VALIDATION_ERROR');
  }
  return String(value);
}

const plainText = (value: unknown, max: number, label: string): string | null => {
  if (value === null || value === undefined) return null;
  const text = String(value).replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim();
  if (text.length > max) throw new AppError(`${label} must be ${max} characters or fewer.`, 400, 'VALIDATION_ERROR');
  return text || null;
};

export function cleanBranding(input: Record<string, unknown>): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  if ('legalName' in input) out.legal_name = plainText(input.legalName, 255, 'Legal name');
  if ('footer' in input) out.footer_text = plainText(input.footer, 300, 'Footer');
  if ('color' in input) {
    const c = input.color == null || input.color === '' ? null : String(input.color);
    if (c && !HEX.test(c)) throw new AppError('Brand colour must look like #1E3A8A.', 400, 'VALIDATION_ERROR');
    out.brand_color = c ? c.toUpperCase() : null;
  }
  if ('logo' in input) out.brand_logo = checkImage(input.logo, 'The logo');
  if ('letterhead' in input) out.letterhead_image = checkImage(input.letterhead, 'The letterhead');
  return out;
}

export async function getBranding(tenantId: string): Promise<Branding | null> {
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, string | null>>>(
    `SELECT name, legal_name, address, city, country, phone, website, footer_text, brand_color, brand_logo, letterhead_image
       FROM global.tenants WHERE id = $1::uuid AND deleted_at IS NULL`, tenantId);
  const r = rows[0];
  if (!r) return null;
  const address = [r.address, r.city, r.country].filter(Boolean).join(', ') || null;
  return {
    name: String(r.name ?? ''), legalName: r.legal_name ?? null, address, phone: r.phone ?? null, website: r.website ?? null,
    footer: r.footer_text ?? null, color: r.brand_color ?? null, logo: r.brand_logo ?? null, letterhead: r.letterhead_image ?? null,
  };
}

export async function saveBranding(tenantId: string, input: Record<string, unknown>): Promise<Branding | null> {
  const fields = cleanBranding(input);
  const cols = Object.keys(fields);
  if (cols.length) {
    const sets = cols.map((c, i) => `${c} = $${i + 2}`).join(', ');
    await prisma.$executeRawUnsafe(`UPDATE global.tenants SET ${sets}, updated_at = NOW() WHERE id = $1::uuid AND deleted_at IS NULL`,
      tenantId, ...cols.map((c) => fields[c]));
  }
  return getBranding(tenantId);
}

/** The image as bytes for a PDF, or null. */
export function imageBytes(dataUrl: string | null): Buffer | null {
  const m = dataUrl ? DATA_URL.exec(dataUrl) : null;
  return m ? Buffer.from(m[2], 'base64') : null;
}

/** Name and footer for text documents; null on any problem (documents still download). */
export async function brandLine(tenantId?: string | null): Promise<{ name: string; footer: string | null } | null> {
  if (!tenantId) return null;
  try {
    const b = await getBranding(tenantId);
    return b ? { name: b.legalName || b.name, footer: b.footer } : null;
  } catch {
    return null;
  }
}