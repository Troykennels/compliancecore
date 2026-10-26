import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { resolveTenant } from '../../middleware/tenant.middleware';
import { enforceEntitlement } from '../../middleware/entitlement.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';
import { validate, validateQuery } from '../../middleware/validate.middleware';
import { asyncHandler } from '../../lib/asyncHandler';
import { createPolicySchema, updatePolicySchema, listPoliciesSchema } from './policies.schema';
import * as ctrl from './policies.controller';
import { policiesService } from './policies.service';
import { ok } from '../../lib/response';
import { policyTemplates, downloadPolicyTemplate } from './policy-templates';
import { NotFoundError } from '../../lib/errors';

const router = Router();
router.use(authenticate(), resolveTenant, enforceEntitlement());
router.get('/templates',requirePermission('policies:read'),asyncHandler(async(req,res)=>ok(res,req,policyTemplates)));
router.get('/templates/:key/download',requirePermission('policies:read'),asyncHandler(async(req,res)=>{if(!downloadPolicyTemplate(req.params.key,res))throw new NotFoundError('Policy template not found.');}));

router.get('/',            requirePermission('policies:read'),  validateQuery(listPoliciesSchema), asyncHandler(ctrl.listPolicies));
router.get('/:id',         requirePermission('policies:read'),  asyncHandler(ctrl.getPolicy));
router.get('/:id/versions',requirePermission('policies:read'),asyncHandler(async(req,res)=>ok(res,req,await policiesService.versions(req.tenant!.schemaName,req.params.id))));
router.post('/',           requirePermission('policies:write'), validate(createPolicySchema), asyncHandler(ctrl.createPolicy));
router.patch('/:id',       requirePermission('policies:write'), validate(updatePolicySchema), asyncHandler(ctrl.updatePolicy));
router.post('/:id/publish', requirePermission('policies:write'), asyncHandler(ctrl.publishPolicy));
router.post('/:id/approve', requirePermission('policies:write'), asyncHandler(async(req,res)=>ok(res,req,await policiesService.approve(req.tenant!.schemaName,req.params.id,{id:req.user!.id,email:req.user!.email,role:req.user!.role??null,tenantId:req.user!.tenantId??null}))));
router.delete('/:id',      requirePermission('policies:delete'), asyncHandler(ctrl.deletePolicy));

export default router;
