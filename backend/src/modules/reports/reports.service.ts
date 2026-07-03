import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import type { ReportFilter, ExecutiveDashboard, ScheduledReport, CreateScheduledReportDto, UpdateScheduledReportDto } from './reports.types';
import * as repo from './reports.repository';

// ── Helpers ────────────────────────────────────────────────────────────────────

function resolveDateRange(filter: ReportFilter): { from: Date; to: Date } {
  const to = filter.dateTo   ? new Date(filter.dateTo)   : new Date();
  const days = filter.days ?? 90;
  const from = filter.dateFrom
    ? new Date(filter.dateFrom)
    : new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return { from, to };
}

// ── Executive Dashboard ────────────────────────────────────────────────────────

export async function getExecutiveDashboard(
  schemaName: string,
  filter: ReportFilter,
): Promise<ExecutiveDashboard> {
  const { from, to } = resolveDateRange(filter);

  const [kpis, scoreTrend, controlsBreakdown, controlsByCriticality,
    frameworkCoverage, tasksBreakdown, evidenceBreakdown, expiryOverview] = await Promise.all([
    repo.getKpis(schemaName),
    repo.getScoreTrend(schemaName, from, to),
    repo.getControlsBreakdown(schemaName),
    repo.getControlsByCriticality(schemaName),
    repo.getFrameworkCoverage(schemaName),
    repo.getTasksBreakdown(schemaName),
    repo.getEvidenceBreakdown(schemaName),
    repo.getExpiryOverview(schemaName),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    filter,
    kpis,
    scoreTrend,
    controlsBreakdown,
    controlsByCriticality,
    frameworkCoverage,
    tasksBreakdown,
    evidenceBreakdown,
    expiryOverview,
  };
}

// ── PDF Export ─────────────────────────────────────────────────────────────────

export async function generateExecutivePdf(
  schemaName: string,
  filter: ReportFilter,
): Promise<Buffer> {
  const data = await getExecutiveDashboard(schemaName, filter);

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50, info: { Title: 'ComplianceCore Executive Report' } });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = 595.28 - 100; // usable width
    const BLUE  = '#2563EB';
    const SLATE = '#1e293b';
    const MUTED = '#64748b';
    const LIGHT = '#f8fafc';
    const BORDER = '#e2e8f0';
    const GREEN  = '#16a34a';
    const RED    = '#dc2626';
    const AMBER  = '#d97706';

    function sectionHeader(title: string): void {
      doc.moveDown(0.5)
        .rect(50, doc.y, W, 26).fill(BLUE)
        .fillColor('white').fontSize(10).font('Helvetica-Bold')
        .text(title.toUpperCase(), 58, doc.y - 19)
        .fillColor(SLATE).font('Helvetica').fontSize(9)
        .moveDown(1);
    }

    function row(label: string, value: string | number, valueColor = SLATE): void {
      const y = doc.y;
      doc.fillColor(MUTED).text(label, 58, y, { width: 220, lineBreak: false });
      doc.fillColor(valueColor).text(String(value), 280, y, { width: 280 });
      doc.moveDown(0.5);
    }

    function kpiBox(x: number, y: number, label: string, value: string | number, sub = '', color = BLUE): void {
      doc.rect(x, y, 115, 60).fill(LIGHT).strokeColor(BORDER).stroke();
      doc.fillColor(color).fontSize(20).font('Helvetica-Bold').text(String(value), x + 8, y + 8, { width: 99 });
      doc.fillColor(SLATE).fontSize(8).font('Helvetica-Bold').text(label, x + 8, y + 35, { width: 99 });
      if (sub) doc.fillColor(MUTED).fontSize(7).font('Helvetica').text(sub, x + 8, y + 46, { width: 99 });
    }

    // ── Cover ────────────────────────────────────────────────────────────────
    doc.rect(0, 0, 595.28, 841.89).fill('#f1f5f9');
    doc.rect(0, 0, 595.28, 200).fill(BLUE);
    doc.fillColor('white').fontSize(26).font('Helvetica-Bold').text('ComplianceCore', 50, 60);
    doc.fontSize(14).font('Helvetica').text('Executive Compliance Report', 50, 94);
    doc.fontSize(10).text(`Generated: ${new Date().toUTCString()}`, 50, 116);
    const { from, to } = resolveDateRange(filter);
    doc.text(`Period: ${from.toDateString()} — ${to.toDateString()}`, 50, 130);

    // KPI strip on cover
    const kpiY = 220;
    kpiBox(50,  kpiY, 'Compliance Score',    `${data.kpis.overallScore}%`, '', data.kpis.overallScore >= 80 ? GREEN : data.kpis.overallScore >= 60 ? AMBER : RED);
    kpiBox(175, kpiY, 'Controls Implemented', data.kpis.implementedControls, `of ${data.kpis.totalControls} total`, BLUE);
    kpiBox(300, kpiY, 'Overdue Tasks',        data.kpis.overdueTasks, `${data.kpis.openTasks} open`, data.kpis.overdueTasks > 0 ? RED : GREEN);
    kpiBox(425, kpiY, 'Expiring Soon (30d)',  data.kpis.expiringIn30Days, `${data.kpis.expiredItems} expired`, data.kpis.expiringIn30Days > 0 ? AMBER : GREEN);

    doc.addPage();

    // ── Executive Summary ─────────────────────────────────────────────────────
    doc.fillColor(SLATE).fontSize(16).font('Helvetica-Bold').text('Executive Summary', 50, 50);
    doc.moveDown(0.5);

    sectionHeader('Key Performance Indicators');
    row('Overall Compliance Score',    `${data.kpis.overallScore}%`);
    row('Total Controls',              data.kpis.totalControls);
    row('Implemented Controls',        `${data.kpis.implementedControls} (${data.kpis.totalControls ? Math.round(data.kpis.implementedControls / data.kpis.totalControls * 100) : 0}%)`);
    row('Partially Implemented',       data.kpis.partiallyImplementedControls);
    row('Not Implemented',             data.kpis.notImplementedControls, data.kpis.notImplementedControls > 0 ? RED : SLATE);
    row('Open Tasks',                  data.kpis.openTasks);
    row('Overdue Tasks',               data.kpis.overdueTasks, data.kpis.overdueTasks > 0 ? RED : GREEN);
    row('Total Evidence Items',        data.kpis.totalEvidence);
    row('Active Evidence',             data.kpis.activeEvidence);
    row('Expiring in 30 Days',         data.kpis.expiringIn30Days, data.kpis.expiringIn30Days > 0 ? AMBER : GREEN);
    row('Expired Items',               data.kpis.expiredItems, data.kpis.expiredItems > 0 ? RED : GREEN);
    row('Pending Approvals',           data.kpis.pendingApprovals);

    // ── Controls ──────────────────────────────────────────────────────────────
    sectionHeader('Controls Analysis');
    row('Implemented',           data.controlsBreakdown.implemented);
    row('Partially Implemented', data.controlsBreakdown.partiallyImplemented);
    row('Not Implemented',       data.controlsBreakdown.notImplemented, data.controlsBreakdown.notImplemented > 0 ? RED : SLATE);
    row('Planned',               data.controlsBreakdown.planned);
    row('Not Applicable',        data.controlsBreakdown.notApplicable);

    doc.moveDown(0.5);
    doc.fillColor(MUTED).fontSize(8).font('Helvetica-Bold').text('BY CRITICALITY', 58);
    doc.moveDown(0.3);

    for (const c of data.controlsByCriticality) {
      const pct = c.total ? Math.round(c.implemented / c.total * 100) : 0;
      row(`${c.criticality.toUpperCase()} (${c.total})`, `${c.implemented} implemented (${pct}%)`, pct >= 80 ? GREEN : pct >= 50 ? AMBER : RED);
    }

    // ── Framework Coverage ────────────────────────────────────────────────────
    if (data.frameworkCoverage.length) {
      sectionHeader('Framework Coverage');
      for (const f of data.frameworkCoverage) {
        row(f.frameworkCode || f.frameworkName, `${f.coveragePercent}% (${f.implementedControls}/${f.totalControls})`,
          f.coveragePercent >= 80 ? GREEN : f.coveragePercent >= 60 ? AMBER : RED);
      }
    }

    // ── Tasks ─────────────────────────────────────────────────────────────────
    sectionHeader('Tasks Overview');
    row('To Do',       data.tasksBreakdown.todo);
    row('In Progress', data.tasksBreakdown.in_progress);
    row('In Review',   data.tasksBreakdown.in_review);
    row('Completed',   data.tasksBreakdown.completed, GREEN);
    row('Blocked',     data.tasksBreakdown.blocked, data.tasksBreakdown.blocked > 0 ? AMBER : SLATE);
    row('Cancelled',   data.tasksBreakdown.cancelled);
    row('Overdue',     data.tasksBreakdown.overdue, data.tasksBreakdown.overdue > 0 ? RED : GREEN);

    // ── Evidence ──────────────────────────────────────────────────────────────
    sectionHeader('Evidence Summary');
    row('Active',   data.evidenceBreakdown.active, GREEN);
    row('Archived', data.evidenceBreakdown.archived);
    row('Expired',  data.evidenceBreakdown.expired, data.evidenceBreakdown.expired > 0 ? RED : SLATE);

    // ── Compliance Score Trend ────────────────────────────────────────────────
    if (data.scoreTrend.length) {
      sectionHeader('Compliance Score Trend (Selected Period)');
      const trendSample = data.scoreTrend.filter((_, i) => i % Math.max(1, Math.floor(data.scoreTrend.length / 15)) === 0);
      for (const pt of trendSample) {
        row(pt.date, `${pt.score}%`);
      }
    }

    // ── Expiry ────────────────────────────────────────────────────────────────
    if (data.expiryOverview.upcoming.length) {
      sectionHeader('Upcoming Expiry Items');
      for (const item of data.expiryOverview.upcoming) {
        row(`${item.name} (${item.entityType})`, `Expires ${item.expiryDate}${item.ownerName ? ' — ' + item.ownerName : ''}`);
      }
    }

    // ── Footer ────────────────────────────────────────────────────────────────
    doc.fillColor(MUTED).fontSize(8)
      .text('ComplianceCore — Confidential', 50, 800, { width: W, align: 'center' });

    doc.end();
  });
}

// ── Excel Export ───────────────────────────────────────────────────────────────

export async function generateExecutiveExcel(
  schemaName: string,
  filter: ReportFilter,
): Promise<Buffer> {
  const data = await getExecutiveDashboard(schemaName, filter);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ComplianceCore';
  wb.created = new Date();

  const BLUE_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
  const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
  const LABEL_FONT:  Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FF1e293b' }, size: 9 };

  function addHeader(ws: ExcelJS.Worksheet, cols: string[]): void {
    const hr = ws.addRow(cols);
    hr.eachCell((cell) => {
      cell.fill = BLUE_FILL;
      cell.font = HEADER_FONT;
      cell.alignment = { vertical: 'middle' };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFe2e8f0' } } };
    });
    hr.height = 22;
  }

  function autoWidth(ws: ExcelJS.Worksheet): void {
    ws.columns.forEach((col) => {
      let max = 10;
      col.eachCell?.({ includeEmpty: false }, (cell) => {
        const len = String(cell.value ?? '').length;
        if (len > max) max = len;
      });
      col.width = Math.min(max + 4, 50);
    });
  }

  // ── Sheet 1: Executive Summary ────────────────────────────────────────────
  const s1 = wb.addWorksheet('Executive Summary');
  s1.addRow(['ComplianceCore Executive Compliance Report']).getCell(1).font = { bold: true, size: 14, color: { argb: 'FF2563EB' } };
  s1.addRow([`Generated: ${new Date().toUTCString()}`]).getCell(1).font = { color: { argb: 'FF64748b' } };
  s1.addRow([]);
  addHeader(s1, ['Metric', 'Value']);

  const kpiRows: [string, string | number][] = [
    ['Overall Compliance Score',    `${data.kpis.overallScore}%`],
    ['Total Controls',              data.kpis.totalControls],
    ['Implemented Controls',        data.kpis.implementedControls],
    ['Partially Implemented',       data.kpis.partiallyImplementedControls],
    ['Not Implemented',             data.kpis.notImplementedControls],
    ['Planned Controls',            data.kpis.plannedControls],
    ['Open Tasks',                  data.kpis.openTasks],
    ['Overdue Tasks',               data.kpis.overdueTasks],
    ['Total Evidence',              data.kpis.totalEvidence],
    ['Active Evidence',             data.kpis.activeEvidence],
    ['Expiring (30 days)',          data.kpis.expiringIn30Days],
    ['Expired Items',               data.kpis.expiredItems],
    ['Pending Approvals',           data.kpis.pendingApprovals],
  ];

  for (const [label, value] of kpiRows) {
    const r = s1.addRow([label, value]);
    r.getCell(1).font = LABEL_FONT;
  }
  autoWidth(s1);

  // ── Sheet 2: Controls ─────────────────────────────────────────────────────
  const s2 = wb.addWorksheet('Controls');
  addHeader(s2, ['Status', 'Count', 'Criticality', 'Total', 'Implemented', '% Implemented']);
  const statusRows = [
    ['Implemented',          data.controlsBreakdown.implemented],
    ['Partially Implemented',data.controlsBreakdown.partiallyImplemented],
    ['Not Implemented',      data.controlsBreakdown.notImplemented],
    ['Planned',              data.controlsBreakdown.planned],
    ['Not Applicable',       data.controlsBreakdown.notApplicable],
  ];
  const critRows = data.controlsByCriticality;
  const maxR = Math.max(statusRows.length, critRows.length);
  for (let i = 0; i < maxR; i++) {
    const sr = statusRows[i] ?? ['', ''];
    const cr = critRows[i];
    const pct = cr && cr.total ? Math.round(cr.implemented / cr.total * 100) : '';
    s2.addRow([sr[0], sr[1], cr?.criticality ?? '', cr?.total ?? '', cr?.implemented ?? '', pct ? `${pct}%` : '']);
  }
  autoWidth(s2);

  // ── Sheet 3: Framework Coverage ───────────────────────────────────────────
  const s3 = wb.addWorksheet('Framework Coverage');
  addHeader(s3, ['Framework', 'Code', 'Total Controls', 'Implemented', 'Coverage %']);
  for (const f of data.frameworkCoverage) {
    const r = s3.addRow([f.frameworkName, f.frameworkCode, f.totalControls, f.implementedControls, `${f.coveragePercent}%`]);
    const pct = f.coveragePercent;
    r.getCell(5).font = { color: { argb: pct >= 80 ? 'FF16a34a' : pct >= 60 ? 'FFd97706' : 'FFdc2626' }, bold: true };
  }
  autoWidth(s3);

  // ── Sheet 4: Tasks ────────────────────────────────────────────────────────
  const s4 = wb.addWorksheet('Tasks');
  addHeader(s4, ['Status', 'Count']);
  const taskRows: [string, number][] = [
    ['To Do',       data.tasksBreakdown.todo],
    ['In Progress', data.tasksBreakdown.in_progress],
    ['In Review',   data.tasksBreakdown.in_review],
    ['Completed',   data.tasksBreakdown.completed],
    ['Blocked',     data.tasksBreakdown.blocked],
    ['Cancelled',   data.tasksBreakdown.cancelled],
    ['Overdue',     data.tasksBreakdown.overdue],
  ];
  for (const [status, count] of taskRows) {
    s4.addRow([status, count]);
  }
  autoWidth(s4);

  // ── Sheet 5: Evidence ─────────────────────────────────────────────────────
  const s5 = wb.addWorksheet('Evidence');
  addHeader(s5, ['Status', 'Count']);
  s5.addRow(['Active',   data.evidenceBreakdown.active]);
  s5.addRow(['Archived', data.evidenceBreakdown.archived]);
  s5.addRow(['Expired',  data.evidenceBreakdown.expired]);
  s5.addRow([]);
  addHeader(s5, ['Category', 'Count']);
  for (const c of data.evidenceBreakdown.byCategory) {
    s5.addRow([c.category, c.count]);
  }
  autoWidth(s5);

  // ── Sheet 6: Score Trend ──────────────────────────────────────────────────
  const s6 = wb.addWorksheet('Compliance Score Trend');
  addHeader(s6, ['Date', 'Score (%)']);
  for (const pt of data.scoreTrend) {
    s6.addRow([pt.date, pt.score]);
  }
  autoWidth(s6);

  // ── Sheet 7: Expiry ───────────────────────────────────────────────────────
  const s7 = wb.addWorksheet('Expiry Items');
  addHeader(s7, ['Name', 'Type', 'Expiry Date', 'Status', 'Owner']);
  for (const item of data.expiryOverview.upcoming) {
    s7.addRow([item.name, item.entityType, item.expiryDate, item.status, item.ownerName ?? '']);
  }
  autoWidth(s7);

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// ── Scheduled Reports ──────────────────────────────────────────────────────────

export async function listScheduledReports(schemaName: string): Promise<ScheduledReport[]> {
  return repo.findScheduledReports(schemaName);
}

export async function createScheduledReport(
  schemaName: string,
  dto: CreateScheduledReportDto,
  userId: string,
): Promise<ScheduledReport> {
  return repo.createScheduledReport(schemaName, dto, userId);
}

export async function updateScheduledReport(
  schemaName: string,
  id: string,
  dto: UpdateScheduledReportDto,
): Promise<ScheduledReport> {
  return repo.updateScheduledReport(schemaName, id, dto);
}

export async function deleteScheduledReport(schemaName: string, id: string): Promise<void> {
  return repo.deleteScheduledReport(schemaName, id);
}
