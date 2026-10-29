import { Router } from "express";
import { z } from "zod";
import { requirePermission } from "../../middleware/rbac.middleware";
import { asyncHandler } from "../../lib/asyncHandler";
import { ok } from "../../lib/response";
import { AppError } from "../../lib/errors";
import {
  recordsService,
  riskContextSchema,
  obligationSchema,
  testSchema,
  decisionSchema,
  riskReviewSchema,
  acknowledgmentSchema,
  vendorQuestionnaireSchema,
  actionSchema,
  incidentDecisionSchema,
  trainingCompletionSchema,
  auditReviewSchema,
  findingClosureSchema,
  type RecordActor,
} from "./compliance-records.service";
import type { Request } from "express";
import { complianceTemplates } from "./compliance-templates";
import { downloadTextDocument } from "../../lib/docx-document";
import { csvCell } from "../../lib/spreadsheet";
import { complianceSummary } from "./compliance-summary";
import { complianceOptions } from "./compliance-options";
import { auditsService } from '../audits/audits.service';
import { createFindingSchema } from '../audits/audits.schema';
function actor(req: Request): RecordActor {
  return {
    id: req.user!.id,
    email: req.user!.email,
    role: req.user!.role ?? null,
    tenantId: req.user!.tenantId ?? null,
  };
}
export const complianceRecordsRouter = Router();
const router = complianceRecordsRouter;
router.post('/records/new-finding',requirePermission('audits:write'),asyncHandler(async(req,res)=>{const body=createFindingSchema.extend({auditId:z.string().uuid()}).parse(req.body);const {auditId,...input}=body;ok(res,req,await auditsService.createFinding(req.tenant!.schemaName,auditId,input,actor(req)));}));
router.get(
  "/records/summary",
  requirePermission("reports:read"),
  asyncHandler(async (req, res) =>
    ok(res, req, await complianceSummary(req.tenant!.schemaName, actor(req))),
  ),
);
router.get(
  "/records/templates",
  requirePermission("reports:read"),
  asyncHandler(async (req, res) => ok(res, req, complianceTemplates)),
);
router.get(
  "/records/templates/:key/download",
  requirePermission("reports:read"),
  asyncHandler(async (req, res) => {
    const t = complianceTemplates.find((v) => v.id === req.params.key);
    if (!t) throw new AppError("Template not found.", 404);
    if (req.query.format === "csv") {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${t.id}-template.csv"`,
      );
      res.send("\uFEFF" + t.fields.map(csvCell).join(",") + "\r\n");
    } else downloadTextDocument(t, res);
  }),
);
router.param("recordId", (_req, _res, next, value) =>
  z.string().uuid().safeParse(value).success
    ? next()
    : next(new AppError("Choose a valid record.", 422)),
);
router.get(
  "/records/search",
  asyncHandler(async (req, res) =>
    ok(
      res,
      req,
      await recordsService.search(
        req.tenant!.schemaName,
        String(req.query.q ?? ""),
        actor(req),
      ),
    ),
  ),
);
router.get(
  "/records/:kind/options",
  asyncHandler(async (req, res) =>
    ok(
      res,
      req,
      await complianceOptions(
        req.tenant!.schemaName,
        req.params.kind,
        String(req.query.source ?? ""),
        String(req.query.q ?? ""),
        actor(req),
      ),
    ),
  ),
);
router.get(
  "/records/:kind/export",
  asyncHandler(async (req, res) => {
    const { records } = await recordsService.workspace(
      req.tenant!.schemaName,
      req.params.kind,
      actor(req),
      req.query.attention === "review",
      Number(req.query.page ?? 1),
          req.query.recordId?String(req.query.recordId):undefined,
    );
    const rows = records as Array<Record<string, unknown>>;
    const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))];
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="compliance-${req.params.kind.replace(/[^a-z-]/g, "")}-latest-200.csv"`,
    );
    res.send(
      "\uFEFF" +
        [
          keys.map(csvCell).join(","),
          ...rows.map((r) => keys.map((k) => csvCell(r[k])).join(",")),
        ].join("\r\n"),
    );
  }),
);
router.get(
  "/records/:kind",
  asyncHandler(async (req, res) =>
    ok(
      res,
      req,
      await recordsService.workspace(
        req.tenant!.schemaName,
        req.params.kind,
        actor(req),
        req.query.attention === "review",
        Number(req.query.page ?? 1),
          req.query.recordId?String(req.query.recordId):undefined,
      ),
    ),
  ),
);
router.post(
  "/records/obligations",
  requirePermission("controls:write"),
  asyncHandler(async (req, res) =>
    ok(
      res,
      req,
      await recordsService.obligation(
        req.tenant!.schemaName,
        obligationSchema.parse(req.body),
        actor(req),
      ),
    ),
  ),
);
router.post(
  "/records/obligations/:recordId/review",
  requirePermission("controls:write"),
  asyncHandler(async (req, res) =>
    ok(
      res,
      req,
      await recordsService.reviewObligation(
        req.tenant!.schemaName,
        req.params.recordId,
        decisionSchema.parse(req.body),
        actor(req),
      ),
    ),
  ),
);
router.post(
  "/records/tests",
  requirePermission("controls:write"),
  asyncHandler(async (req, res) =>
    ok(
      res,
      req,
      await recordsService.submitTest(
        req.tenant!.schemaName,
        testSchema.parse(req.body),
        actor(req),
      ),
    ),
  ),
);
router.post(
  "/records/tests/:recordId/review",
  requirePermission("controls:write"),
  asyncHandler(async (req, res) =>
    ok(
      res,
      req,
      await recordsService.reviewTest(
        req.tenant!.schemaName,
        req.params.recordId,
        decisionSchema.parse(req.body),
        actor(req),
      ),
    ),
  ),
);
router.post(
  "/records/risk-context",
  requirePermission("risks:write"),
  asyncHandler(async (req, res) =>
    ok(
      res,
      req,
      await recordsService.assignRiskContext(
        req.tenant!.schemaName,
        riskContextSchema.parse(req.body),
        actor(req),
      ),
    ),
  ),
);
router.post(
  "/records/risks",
  requirePermission("risks:write"),
  asyncHandler(async (req, res) =>
    ok(
      res,
      req,
      await recordsService.reviewRisk(
        req.tenant!.schemaName,
        riskReviewSchema.parse(req.body),
        actor(req),
      ),
    ),
  ),
);
router.post(
  "/records/acknowledgments",
  requirePermission("policies:write"),
  asyncHandler(async (req, res) =>
    ok(
      res,
      req,
      await recordsService.assignAcknowledgments(
        req.tenant!.schemaName,
        acknowledgmentSchema.parse(req.body),
        actor(req),
      ),
    ),
  ),
);
router.post(
  "/records/acknowledgments/:recordId/acknowledge",
  requirePermission("policies:read"),
  asyncHandler(async (req, res) =>
    ok(
      res,
      req,
      await recordsService.acknowledge(
        req.tenant!.schemaName,
        req.params.recordId,
        actor(req),
      ),
    ),
  ),
);
router.post(
  "/records/vendors",
  requirePermission("vendors:write"),
  asyncHandler(async (req, res) =>
    ok(
      res,
      req,
      await recordsService.submitVendor(
        req.tenant!.schemaName,
        vendorQuestionnaireSchema.parse(req.body),
        actor(req),
      ),
    ),
  ),
);
router.post(
  "/records/vendors/:recordId/review",
  requirePermission("vendors:write"),
  asyncHandler(async (req, res) =>
    ok(
      res,
      req,
      await recordsService.reviewVendor(
        req.tenant!.schemaName,
        req.params.recordId,
        decisionSchema.parse(req.body),
        actor(req),
      ),
    ),
  ),
);
router.post(
  "/records/actions",
  requirePermission("tasks:assign"),
  asyncHandler(async (req, res) =>
    ok(
      res,
      req,
      await recordsService.action(
        req.tenant!.schemaName,
        actionSchema.parse(req.body),
        actor(req),
      ),
    ),
  ),
);
router.post(
  "/records/actions/:recordId/review",
  requirePermission("tasks:assign"),
  asyncHandler(async (req, res) =>
    ok(
      res,
      req,
      await recordsService.verifyAction(
        req.tenant!.schemaName,
        req.params.recordId,
        decisionSchema.parse(req.body),
        actor(req),
      ),
    ),
  ),
);
router.post(
  "/records/incidents",
  requirePermission("incidents:write"),
  asyncHandler(async (req, res) =>
    ok(
      res,
      req,
      await recordsService.incident(
        req.tenant!.schemaName,
        incidentDecisionSchema.parse(req.body),
        actor(req),
      ),
    ),
  ),
);
router.post(
  "/records/training",
  requirePermission("training:write"),
  asyncHandler(async (req, res) =>
    ok(
      res,
      req,
      await recordsService.completeTraining(
        req.tenant!.schemaName,
        trainingCompletionSchema.parse(req.body),
        actor(req),
      ),
    ),
  ),
);
router.post(
  "/records/audits",
  requirePermission("audits:write"),
  asyncHandler(async (req, res) =>
    ok(
      res,
      req,
      await recordsService.reviewAudit(
        req.tenant!.schemaName,
        auditReviewSchema.parse(req.body),
        actor(req),
      ),
    ),
  ),
);
router.post(
  "/records/findings",
  requirePermission("audits:write"),
  asyncHandler(async (req, res) =>
    ok(
      res,
      req,
      await recordsService.closeFinding(
        req.tenant!.schemaName,
        findingClosureSchema.parse(req.body),
        actor(req),
      ),
    ),
  ),
);
