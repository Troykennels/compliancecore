import crypto from 'node:crypto';
import type {Request,Response} from 'express';
import {env} from '../../config/env';
import {prisma} from '../../config/database';
export async function renewalOverview(req:Request,res:Response){
  res.setHeader('Cache-Control','private, no-store');
  const expected=env.RENEWAL_DASHBOARD_API_KEY||'',supplied=req.header('X-Renewal-Dashboard-Key')||'';
  if(!expected||Buffer.byteLength(expected)!==Buffer.byteLength(supplied)||!crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(supplied)))return res.status(401).json({error:'Unauthorized'});
  const rows=await prisma.$queryRawUnsafe<any[]>(`SELECT s.id,t.name,p.name AS product,s.current_period_end,s.next_invoice_amount,s.status,
    COALESCE((SELECT rc.email FROM global.recurring_consents rc WHERE rc.tenant_id=t.id),(SELECT u.email FROM global.users u JOIN global.tenant_memberships m ON m.user_id=u.id WHERE m.tenant_id=t.id AND m.role='owner' AND m.deleted_at IS NULL LIMIT 1)) AS billing_email,
    EXISTS(SELECT 1 FROM global.recurring_consents rc WHERE rc.tenant_id=t.id AND rc.enabled AND rc.amount=s.next_invoice_amount AND rc.plan_id=s.plan_id AND rc.cycle=s.billing_cycle AND rc.currency=s.currency) AS automatic
    FROM global.subscriptions s JOIN global.tenants t ON t.id=s.tenant_id JOIN global.subscription_plans p ON p.id=s.plan_id WHERE t.deleted_at IS NULL ORDER BY s.current_period_end LIMIT 500`);
  return res.json({customers:rows.map(r=>({billing_email:r.billing_email,id:'compliancecore:'+r.id,customer:r.name,product:'ComplianceCore - '+r.product,source:'ComplianceCore',paid_through:r.current_period_end,amount:Number(r.next_invoice_amount),status:r.status,recurring:{enabled:r.automatic},renewal_url:env.FRONTEND_URL.replace(/\/$/,'')+'/billing/plans'}))});
}
