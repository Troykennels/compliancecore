import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { resolveTenant } from '../../middleware/tenant.middleware';
import { enforceEntitlement } from '../../middleware/entitlement.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';
import { asyncHandler } from '../../lib/asyncHandler';
import * as ctrl from './tasks.controller';

const router = Router();
router.use(authenticate(), resolveTenant, enforceEntitlement());

router.get('/overdue',           requirePermission('tasks:read'),  asyncHandler(ctrl.getOverdueTasks));
router.get('/stats',             requirePermission('tasks:read'),  asyncHandler(ctrl.getTaskStats));
router.get('/',                  requirePermission('tasks:read'),  asyncHandler(ctrl.listTasks));
router.post('/',                 requirePermission('tasks:write'), asyncHandler(ctrl.createTask));
router.get('/:id',               requirePermission('tasks:read'),  asyncHandler(ctrl.getTask));
router.get('/:id/subtasks',      requirePermission('tasks:read'),  asyncHandler(ctrl.getSubtasks));
router.patch('/:id',             requirePermission('tasks:write'), asyncHandler(ctrl.updateTask));
router.delete('/:id',            requirePermission('tasks:write'), asyncHandler(ctrl.deleteTask));
router.get('/:id/comments',      requirePermission('tasks:read'),  asyncHandler(ctrl.getComments));
router.post('/:id/comments',     requirePermission('tasks:write'), asyncHandler(ctrl.addComment));
router.delete('/:id/comments/:commentId', requirePermission('tasks:write'), asyncHandler(ctrl.deleteComment));

export { router as tasksRouter };
