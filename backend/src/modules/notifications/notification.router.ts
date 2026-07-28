import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { resolveTenant } from '../../middleware/tenant.middleware';
import { enforceEntitlement } from '../../middleware/entitlement.middleware';
import { asyncHandler } from '../../lib/asyncHandler';
import * as ctrl from './notification.controller';

const router = Router();
router.use(authenticate(), resolveTenant, enforceEntitlement());

router.get('/',             asyncHandler(ctrl.listNotifications));
router.get('/unread-count', asyncHandler(ctrl.getUnreadCount));
router.post('/mark-all-read', asyncHandler(ctrl.markAllRead));
router.patch('/:id/read',   asyncHandler(ctrl.markRead));
router.delete('/:id',       asyncHandler(ctrl.dismissNotification));

export default router;
