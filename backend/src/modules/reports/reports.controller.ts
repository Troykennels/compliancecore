import type { Request, Response } from 'express';
import { z } from 'zod';
import * as service from './reports.service';

const filterSchema = z.object({
  days:     z.coerce.number().int().min(7).max(365).optional(),
  dateFrom: z.string().optional(),
  dateTo:   z.string().optional(),
});

const createSchema = z.object({
  name:        z.string().min(1).max(255),
  frequency:   z.enum(['daily', 'weekly', 'monthly']),
  dayOfWeek:   z.coerce.number().int().min(0).max(6).optional(),
  dayOfMonth:  z.coerce.number().int().min(1).max(31).optional(),
  hour:        z.coerce.number().int().min(0).max(23).optional(),
  recipients:  z.array(z.string().email()).min(1).max(20),
  format:      z.enum(['pdf', 'excel', 'both']).optional(),
});

const updateSchema = createSchema.partial().extend({
  isActive: z.boolean().optional(),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const schema = (req: Request) => (req as any).tenant.schemaName as string;

export async function getExecutiveDashboard(req: Request, res: Response) {
  const filter = filterSchema.parse(req.query);
  const data = await service.getExecutiveDashboard(schema(req), filter);
  res.json({ success: true, data });
}

export async function exportPdf(req: Request, res: Response) {
  const filter = filterSchema.parse(req.query);
  const buffer = await service.generateExecutivePdf(schema(req), filter);
  const filename = `compliance-report-${new Date().toISOString().slice(0, 10)}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', buffer.length);
  res.end(buffer);
}

export async function exportExcel(req: Request, res: Response) {
  const filter = filterSchema.parse(req.query);
  const buffer = await service.generateExecutiveExcel(schema(req), filter);
  const filename = `compliance-report-${new Date().toISOString().slice(0, 10)}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', buffer.length);
  res.end(buffer);
}

export async function listScheduledReports(req: Request, res: Response) {
  const reports = await service.listScheduledReports(schema(req));
  res.json({ success: true, data: reports });
}

export async function createScheduledReport(req: Request, res: Response) {
  const dto = createSchema.parse(req.body);
  const report = await service.createScheduledReport(schema(req), dto, req.user!.id);
  res.status(201).json({ success: true, data: report });
}

export async function updateScheduledReport(req: Request, res: Response) {
  const dto = updateSchema.parse(req.body);
  const report = await service.updateScheduledReport(schema(req), req.params.id, dto);
  res.json({ success: true, data: report });
}

export async function deleteScheduledReport(req: Request, res: Response) {
  await service.deleteScheduledReport(schema(req), req.params.id);
  res.json({ success: true, data: null });
}
