import { Router, type Request } from "express";
import { z } from "zod";
import { asyncHandler } from "../../lib/asyncHandler";
import { validate } from "../../middleware/validate.middleware";
import { ok, noContent } from "../../lib/response";
import { AppError } from "../../lib/errors";
import {
  auditRoomService as service,
  requestSchema,
  participantSchema,
  attachmentSchema,
  commentSchema,
  decisionSchema,
} from "./audit-room.service";

// Authentication, tenant resolution and entitlement checks are inherited from audits.router.
const router = Router({ mergeParams: true });
const actor = (req: Request) => ({
  id: req.user!.id,
  email: req.user!.email,
  role: req.user!.role ?? null,
  tenantId: req.user!.tenantId ?? null,
});
router.use((req, _res, next) =>
  z.string().uuid().safeParse(req.params.id).success
    ? next()
    : next(new AppError("Audit not found.", 404)),
);
for (const name of ["requestId", "userId"])
  router.param(name, (_req, _res, next, value) =>
    z.string().uuid().safeParse(value).success
      ? next()
      : next(new AppError("Record not found.", 404)),
  );
router.get(
  "/",
  asyncHandler(async (req, res) =>
    ok(
      res,
      req,
      await service.get(req.tenant!.schemaName, req.params.id, actor(req)),
    ),
  ),
);
router.post(
  "/participants",
  validate(participantSchema),
  asyncHandler(async (req, res) => {
    await service.addParticipant(
      req.tenant!.schemaName,
      req.params.id,
      req.body,
      actor(req),
    );
    noContent(res);
  }),
);
router.delete(
  "/participants/:userId",
  asyncHandler(async (req, res) => {
    await service.removeParticipant(
      req.tenant!.schemaName,
      req.params.id,
      req.params.userId,
      actor(req),
    );
    noContent(res);
  }),
);
router.post(
  "/requests",
  validate(requestSchema),
  asyncHandler(async (req, res) =>
    ok(
      res,
      req,
      await service.create(
        req.tenant!.schemaName,
        req.params.id,
        req.body,
        actor(req),
      ),
      201,
    ),
  ),
);
router.post(
  "/requests/:requestId/evidence",
  validate(attachmentSchema),
  asyncHandler(async (req, res) => {
    await service.attach(
      req.tenant!.schemaName,
      req.params.id,
      req.params.requestId,
      req.body,
      actor(req),
    );
    noContent(res);
  }),
);
router.post(
  "/requests/:requestId/comments",
  validate(commentSchema),
  asyncHandler(async (req, res) => {
    await service.comment(
      req.tenant!.schemaName,
      req.params.id,
      req.params.requestId,
      req.body.body,
      actor(req),
    );
    noContent(res);
  }),
);
router.post(
  "/requests/:requestId/decision",
  validate(decisionSchema),
  asyncHandler(async (req, res) => {
    await service.decide(
      req.tenant!.schemaName,
      req.params.id,
      req.params.requestId,
      req.body,
      actor(req),
    );
    noContent(res);
  }),
);
router.post(
  "/requests/:requestId/update",
  validate(requestSchema),
  asyncHandler(async (req, res) => {
    await service.update(
      req.tenant!.schemaName,
      req.params.id,
      req.params.requestId,
      req.body,
      actor(req),
    );
    noContent(res);
  }),
);
router.post(
  "/requests/:requestId/archive",
  asyncHandler(async (req, res) => {
    await service.archive(
      req.tenant!.schemaName,
      req.params.id,
      req.params.requestId,
      actor(req),
    );
    noContent(res);
  }),
);
router.post(
  "/requests/:requestId/evidence/remove",
  validate(attachmentSchema),
  asyncHandler(async (req, res) => {
    await service.removeAttachment(
      req.tenant!.schemaName,
      req.params.id,
      req.params.requestId,
      req.body,
      actor(req),
    );
    noContent(res);
  }),
);
export default router;
