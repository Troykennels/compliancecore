import { assessmentOutcomeService, outcomeSchema } from './assessment-outcome.service';
import { Router } from 'express';
import { z } from 'zod';
import { requirePermission } from '../../middleware/rbac.middleware';
import { validate } from '../../middleware/validate.middleware';
import { asyncHandler } from '../../lib/asyncHandler';
import { ok } from '../../lib/response';
import { implementationService, implementationPlanSchema } from './implementation.service';
import { frameworksService } from './frameworks.service';
import { enforceLimit } from '../../middleware/entitlement.middleware';
import { countAdoptedFrameworks } from '../../lib/usage-counts';
import type { Request } from 'express';
import { AppError } from '../../lib/errors';
import { assessmentService, engagementSchema, worksheetRiskSchema } from './assessment.service';
import { assessmentWorkbook } from './assessment-export';
const actor = (req: Request) => ({
  id: req.user!.id,
  email: req.user!.email,
  role: req.user!.role ?? null,
  tenantId: req.user!.tenantId ?? null,
});
export const implementationRouter = Router();
for (const name of ['id', 'controlId', 'riskId'])
  implementationRouter.param(name, (_req, _res, next, value) => {
    if (!z.string().uuid().safeParse(value).success)
      return next(new AppError('A valid record identifier is required.', 422, 'INVALID_ID'));
    next();
  });
implementationRouter.get(
  '/:id/assessment',
  requirePermission('controls:read'),
  asyncHandler(async (req, res) =>
    ok(res, req, await assessmentService.get(req.tenant!.schemaName, req.params.id, actor(req))),
  ),
);
implementationRouter.get(
  '/:id/assessment/workbook',
  requirePermission('controls:read'),
  asyncHandler(async (req, res) => {
    const data = await assessmentService.get(req.tenant!.schemaName, req.params.id, actor(req));
    const buffer = await assessmentWorkbook(data);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="Compliance-assessment-${data.framework.code.replace(/[^a-zA-Z0-9_-]/g, '')}.xlsx"`,
    );
    res.send(Buffer.from(buffer));
  }),
);
implementationRouter.put(
  '/:id/assessment/engagement',
  requirePermission('controls:write'),
  validate(engagementSchema),
  asyncHandler(async (req, res) =>
    ok(
      res,
      req,
      await assessmentService.engagement(
        req.tenant!.schemaName,
        req.params.id,
        req.body,
        actor(req),
      ),
    ),
  ),
);
implementationRouter.put(
  '/:id/assessment/risks',
  requirePermission('controls:write'),
  validate(worksheetRiskSchema),
  asyncHandler(async (req, res) =>
    ok(
      res,
      req,
      await assessmentService.risk(req.tenant!.schemaName, req.params.id, req.body, actor(req)),
    ),
  ),
);
implementationRouter.delete(
  '/:id/assessment/risks/:riskId',
  requirePermission('controls:write'),
  asyncHandler(async (req, res) =>
    ok(
      res,
      req,
      await assessmentService.removeRisk(
        req.tenant!.schemaName,
        req.params.id,
        req.params.riskId,
        actor(req),
      ),
    ),
  ),
);
implementationRouter.get(
  '/implementation-overview',
  requirePermission('controls:read'),
  asyncHandler(async (req, res) =>
    ok(res, req, await implementationService.overview(req.tenant!.schemaName, actor(req))),
  ),
);
implementationRouter.get(
  '/implementation-members',
  requirePermission('controls:read'),
  asyncHandler(async (req, res) =>
    ok(res, req, await implementationService.members(req.tenant!.schemaName, actor(req))),
  ),
);
implementationRouter.get(
  '/:id/implementation',
  requirePermission('controls:read'),
  asyncHandler(async (req, res) =>
    ok(
      res,
      req,
      await implementationService.get(req.tenant!.schemaName, req.params.id, actor(req)),
    ),
  ),
);
implementationRouter.put(
  '/:id/implementation',
  requirePermission('controls:write'),
  validate(implementationPlanSchema),
  asyncHandler(async (req, res) =>
    ok(
      res,
      req,
      await implementationService.save(req.tenant!.schemaName, req.params.id, req.body, actor(req)),
    ),
  ),
);
implementationRouter.put(
  '/:id/implementation/preparation',
  requirePermission('controls:write'),
  validate(
    z.object({
      baseline: z.string().trim().max(5000).optional(),
      risks: z.string().trim().max(5000).optional(),
      managementReview: z
        .string()
        .trim()
        .max(5000)
        .refine((v) => v === '' || v.length >= 30)
        .optional(),
      internalAuditId: z.string().uuid().nullable().optional(),
      trainingProgramId: z.string().uuid().nullable().optional(),
      obligations: z
        .string()
        .trim()
        .max(5000)
        .refine((v) => v === '' || v.length >= 30)
        .optional(),
      riskMethod: z
        .string()
        .trim()
        .max(5000)
        .refine((v) => v === '' || v.length >= 30)
        .optional(),
      assessmentPeriod: z
        .string()
        .trim()
        .max(500)
        .refine((v) => v === '' || v.length >= 5)
        .optional(),
      monitoring: z
        .string()
        .trim()
        .max(5000)
        .refine((v) => v === '' || v.length >= 30)
        .optional(),
    }),
  ),
  asyncHandler(async (req, res) =>
    ok(
      res,
      req,
      await implementationService.preparation(
        req.tenant!.schemaName,
        req.params.id,
        req.body,
        actor(req),
      ),
    ),
  ),
);
implementationRouter.put(
  '/:id/implementation/soa/:controlId',
  requirePermission('controls:write'),
  validate(
    z.object({
      applicable: z.boolean(),
      justification: z.string().trim().min(20).max(5000),
      evidenceId: z.string().uuid().nullable().optional(),
    }),
  ),
  asyncHandler(async (req, res) =>
    ok(
      res,
      req,
      await implementationService.soa(
        req.tenant!.schemaName,
        req.params.id,
        req.params.controlId,
        req.body.applicable,
        req.body.justification,
        actor(req),
        req.body.evidenceId,
      ),
    ),
  ),
);
implementationRouter.post(
  '/:id/implementation/start',
  requirePermission('controls:write'),
  enforceLimit('frameworks', countAdoptedFrameworks, {
    skipIf: (req) => frameworksService.isAdopted(req.tenant!.schemaName, req.params.id),
  }),
  asyncHandler(async (req, res) => {
    const result = await frameworksService.adopt(req.tenant!.schemaName, req.params.id, actor(req));
    ok(res, req, result);
  }),
);
implementationRouter.post(
  '/:id/implementation/actions',
  requirePermission('tasks:assign'),
  asyncHandler(async (req, res) =>
    ok(
      res,
      req,
      await implementationService.actions(req.tenant!.schemaName, req.params.id, actor(req)),
    ),
  ),
);
implementationRouter.post(
  '/:id/implementation/review',
  requirePermission('approvals:decide'),
  validate(
    z.object({
      action: z.enum(['submit', 'approve', 'return']),
      note: z.string().trim().max(5000).default(''),
    }),
  ),
  asyncHandler(async (req, res) =>
    ok(
      res,
      req,
      await implementationService.review(
        req.tenant!.schemaName,
        req.params.id,
        req.body.action,
        req.body.note,
        actor(req),
      ),
    ),
  ),
);

implementationRouter.put(
  '/:id/implementation/outcome',
  requirePermission('controls:write'),
  validate(outcomeSchema),
  asyncHandler(async (req, res) =>
    ok(
      res,
      req,
      await assessmentOutcomeService.save(
        req.tenant!.schemaName,
        req.params.id,
        req.body,
        actor(req),
      ),
    ),
  ),
);
implementationRouter.post(
  '/:id/implementation/outcome/review',
  requirePermission('approvals:decide'),
  asyncHandler(async (req, res) =>
    ok(
      res,
      req,
      await assessmentOutcomeService.review(req.tenant!.schemaName, req.params.id, actor(req)),
    ),
  ),
);
