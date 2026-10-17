import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { resolveTenant } from '../../middleware/tenant.middleware';
import { enforceEntitlement } from '../../middleware/entitlement.middleware';
import { asyncHandler } from '../../lib/asyncHandler';
import * as ctrl from './notification.controller';
import { pushKeys, subscribeDevice, unsubscribeDevice, testPush } from './push.service';
import { validSubscription } from './push-core';

const router = Router();
router.use(authenticate(), resolveTenant, enforceEntitlement());

router.get('/push', asyncHandler(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  res.json({publicKey:(await pushKeys()).publicKey});
}));
router.post('/push',asyncHandler(async(req,res)=>{
  if(req.body?.action==='test') await testPush(req.tenant!.schemaName,req.user!.id);
  else {
    if(!validSubscription(req.body)){res.status(400).json({error:'Invalid push subscription'});return;}
    await subscribeDevice(req.tenant!.schemaName,req.user!.id,req.body);
  }
  res.json({ok:true});
}));
router.delete('/push',asyncHandler(async(req,res)=>{
  if(typeof req.body?.endpoint!=='string'){res.status(400).json({error:'Missing device'});return;}
  await unsubscribeDevice(req.tenant!.schemaName,req.user!.id,req.body.endpoint);
  res.json({ok:true});
}));

router.get('/',             asyncHandler(ctrl.listNotifications));
router.get('/unread-count', asyncHandler(ctrl.getUnreadCount));
router.post('/mark-all-read', asyncHandler(ctrl.markAllRead));
router.patch('/:id/read',   asyncHandler(ctrl.markRead));
router.delete('/:id',       asyncHandler(ctrl.dismissNotification));

export default router;
