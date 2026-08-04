import archiver from 'archiver';
import type { Response } from 'express';
import { prisma, withTenantSchema } from '../../lib/prisma';
import { logger } from '../../lib/logger';

/**
 * Full organisation data export.
 *
 * Exists because "you can download the reports" is not a portability answer.
 * GDPR Article 20 and the NDPA both entitle people to their data in a
 * structured, commonly used, machine-readable form, and any customer evaluating
 * a compliance vendor will ask what happens to their records if they leave.
 *
 * Two formats for two audiences: JSON so another system can ingest it, CSV so a
 * person can open it in Excel. Same data, no interpretation applied to either.
 *
 * Tables are discovered from the catalogue rather than hard-coded. A hard-coded
 * list silently stops exporting whatever module was added last, and the failure
 * is invisible until a customer notices their incidents are missing.
 */

/** Columns that must never leave the system, matched case-insensitively. */
const SENSITIVE_COLUMNS = new Set([
  'password_hash', 'secret_encrypted', 'backup_codes_encrypted', 'token_hash',
  'share_token', 'webhook_secret', 'key_hash', 'signature_hash',
  'email_verification_token_hash', 'password_reset_token_hash',
]);

function scrub(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map((row) => {
    const clean: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      if (SENSITIVE_COLUMNS.has(key.toLowerCase())) continue;
      // BigInt (COUNT results, bigserial columns) is not JSON-serialisable.
      clean[key] = typeof value === 'bigint' ? value.toString() : value;
    }
    return clean;
  });
}

/** RFC 4180 CSV. Excel needs the BOM or it mangles non-ASCII on open. */
function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);

  const cell = (v: unknown): string => {
    if (v === null || v === undefined) return '';
    if (v instanceof Date) return v.toISOString();
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  return '﻿' + [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => cell(r[h])).join(',')),
  ].join('\r\n');
}

interface ExportContext {
  tenantId: string;
  schemaName: string;
  requestedBy: string;
}

/**
 * Streams a ZIP of everything the organisation owns straight to the response.
 *
 * Streamed rather than buffered: a mature tenant's export can be large, and
 * assembling it in memory first would risk the process on the exact accounts
 * that most need it.
 */
export async function streamOrganizationExport(res: Response, ctx: ExportContext): Promise<void> {
  const { tenantId, schemaName, requestedBy } = ctx;
  const generatedAt = new Date().toISOString();

  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId, deletedAt: null },
    select: {
      id: true, name: true, slug: true, industry: true, size: true, country: true,
      city: true, website: true, phone: true, timezone: true, dateFormat: true,
      plan: true, createdAt: true,
    },
  });

  const safeName = (tenant?.slug ?? 'organisation').replace(/[^a-z0-9-]/gi, '-');
  const filename = `compliancecore-export-${safeName}-${generatedAt.slice(0, 10)}.zip`;

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const archive = archiver('zip', { zlib: { level: 9 } });

  // A failure mid-stream cannot become a 500 — headers are already sent — so log
  // it and end the response rather than leaving the download hanging.
  archive.on('error', (err) => {
    logger.error({ err, tenantId }, 'Organisation export failed mid-stream');
    res.destroy();
  });
  archive.on('warning', (err) => {
    logger.warn({ err, tenantId }, 'Organisation export warning');
  });

  archive.pipe(res);

  // ── Organisation profile and people (global schema) ────────────────────────
  const memberships = await prisma.tenantMembership.findMany({
    where: { tenantId, deletedAt: null },
    select: {
      role: true, joinedAt: true, isActive: true,
      user: { select: { id: true, email: true, firstName: true, lastName: true, createdAt: true } },
    },
  });

  const people = memberships.map((m) => ({
    userId: m.user.id,
    email: m.user.email,
    firstName: m.user.firstName,
    lastName: m.user.lastName,
    role: m.role,
    joinedAt: m.joinedAt,
    isActive: m.isActive,
    accountCreatedAt: m.user.createdAt,
  }));

  const addTable = (name: string, rows: Record<string, unknown>[]) => {
    archive.append(JSON.stringify(rows, null, 2), { name: `data/${name}.json` });
    if (rows.length) archive.append(toCsv(rows), { name: `csv/${name}.csv` });
  };

  addTable('organisation', tenant ? [tenant as unknown as Record<string, unknown>] : []);
  addTable('team-members', people as unknown as Record<string, unknown>[]);

  // ── Every per-tenant table, discovered from the catalogue ──────────────────
  const exported: { table: string; rows: number }[] = [];

  await withTenantSchema(schemaName, async (tx) => {
    const tables = await tx.$queryRawUnsafe<{ table_name: string }[]>(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = $1 AND table_type = 'BASE TABLE'
        ORDER BY table_name`,
      schemaName,
    );

    for (const { table_name: table } of tables) {
      // Identifier comes from the catalogue for this one schema, so it cannot be
      // attacker-controlled; quote it anyway so unusual names cannot break out.
      const rows = await tx.$queryRawUnsafe<Record<string, unknown>[]>(
        `SELECT * FROM "${schemaName}"."${table}"`,
      );
      const clean = scrub(rows);
      addTable(table, clean);
      exported.push({ table, rows: clean.length });
    }
  }, { timeout: 120_000, maxWait: 20_000 });

  // ── Manifest and README ───────────────────────────────────────────────────
  const manifest = {
    generatedAt,
    generatedBy: requestedBy,
    organisation: { id: tenant?.id, name: tenant?.name, slug: tenant?.slug },
    format: 'JSON (data/) and CSV (csv/)',
    tables: exported,
    totalRows: exported.reduce((sum, t) => sum + t.rows, 0),
    note: 'Evidence file contents are not included. See README.txt.',
  };
  archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });

  archive.append(
    [
      `ComplianceCore — data export for ${tenant?.name ?? 'your organisation'}`,
      `Generated ${generatedAt} by ${requestedBy}`,
      '',
      'WHAT IS IN HERE',
      '  data/    every record as JSON, for loading into another system',
      '  csv/     the same records as CSV, for opening in Excel',
      '  manifest.json  what was exported and how many rows of each',
      '',
      'This is everything your organisation holds in ComplianceCore: controls,',
      'policies, risks, incidents, vendors, audits, training, tasks, approvals,',
      'signatures, evidence metadata, calendar and expiry items, and your team.',
      '',
      'WHAT IS NOT IN HERE',
      '  * The evidence FILES themselves. Their metadata, versions and checksums',
      '    are included (see data/evidence.json and data/evidence_versions.json),',
      '    but the documents are stored separately and can run to many gigabytes.',
      '    Download them from the Evidence Hub, or ask us for a bulk transfer.',
      '  * Secrets. Password hashes, MFA secrets, API key hashes, webhook secrets',
      '    and share tokens are deliberately excluded. They are of no use to you',
      '    and would be a liability in a file like this.',
      '',
      'YOUR RIGHTS',
      'This export exists so your data is portable. You are entitled to it under',
      'GDPR Article 20 and the Nigeria Data Protection Act, and you should be able',
      'to get it from any vendor holding your records — including this one.',
      '',
      'ORION SOFT LIMITED',
    ].join('\n'),
    { name: 'README.txt' },
  );

  logger.info(
    { tenantId, requestedBy, tables: exported.length, rows: manifest.totalRows },
    'Organisation export generated',
  );

  await archive.finalize();
}
