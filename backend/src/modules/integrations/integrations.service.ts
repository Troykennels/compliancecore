import nodemailer from 'nodemailer';
import { prisma, withTenantSchema } from '../../lib/prisma';
import { encrypt, decrypt } from '../../lib/crypto';
import { AppError, NotFoundError, ValidationError } from '../../lib/errors';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import { postProvider, resolvePublic, webhookUrl } from './connector-network';
import { saveSchema, type ConnectorConfig, type Provider } from './integrations.schema';

type Secrets = {webhookUrl?:string;username?:string;password?:string;apiKey?:string};
type Connection = {id:string;revision:string;tenant_id:string;provider:Provider;config:ConnectorConfig;encrypted_secrets:string;enabled:boolean;enabled_at:Date|null;verified_at:Date|null;updated_at:Date};
type Note = {id:string;user_id:string;title:string;body:string|null;notification_type:string;priority:string;email?:string};
function publicConnection(c:Connection) {
  const secrets:Secrets=JSON.parse(decrypt(c.encrypted_secrets));
  return {provider:c.provider,config:c.config,enabled:c.enabled,verifiedAt:c.verified_at,updatedAt:c.updated_at,configuredSecrets:Object.keys(secrets).filter(k=>Boolean(secrets[k as keyof Secrets]))};
}
async function connection(tenantId:string,provider:Provider) {
  const rows=await prisma.$queryRaw<Connection[]>`SELECT * FROM global.notification_integrations WHERE tenant_id=${tenantId}::uuid AND provider=${provider}`;
  if(!rows.length)throw new NotFoundError('Save the connection settings first');return rows[0];
}
export async function listIntegrations(tenantId:string) {
  const rows=await prisma.$queryRaw<Connection[]>`SELECT * FROM global.notification_integrations WHERE tenant_id=${tenantId}::uuid ORDER BY provider`;
  return rows.map(publicConnection);
}
export async function saveIntegration(tenantId:string,provider:Provider,userId:string,input:unknown) {
  const data=saveSchema.parse(input);
  const previous=await prisma.$queryRaw<Connection[]>`SELECT * FROM global.notification_integrations WHERE tenant_id=${tenantId}::uuid AND provider=${provider}`;
  const secrets:Secrets=previous.length?JSON.parse(decrypt(previous[0].encrypted_secrets)):{};
  for(const [key,value] of Object.entries(data.secrets))if(value?.trim())secrets[key as keyof Secrets]=key==='password'||key==='username'?value:value.trim();
  if(provider==='email') {
    if(data.config.events.some(e=>!['expiry_warning','task_assigned','approval_decided','escalation'].includes(e)))throw new ValidationError('Choose an event with email delivery support.');
    if(!data.config.from)throw new ValidationError('A verified sender email is required.');
    if(data.config.transport==='smtp'){
      if(!data.config.host||!secrets.username||!secrets.password)throw new ValidationError('SMTP host, username and password are required.');
      await resolvePublic(data.config.host);
      delete secrets.apiKey;
    }else if(!secrets.apiKey)throw new ValidationError('A Brevo API key is required.');
    if(data.config.transport==='brevo'){delete secrets.username;delete secrets.password;}
    delete secrets.webhookUrl;
  }else{
    if(!secrets.webhookUrl)throw new ValidationError('A webhook URL is required.');
    const url=webhookUrl(provider,secrets.webhookUrl);await resolvePublic(url.hostname);
    delete secrets.password;delete secrets.username;delete secrets.apiKey;
  }
  const encrypted=encrypt(JSON.stringify(secrets));
  const config=JSON.stringify(data.config);
  const rows=await prisma.$queryRaw<Connection[]>`INSERT INTO global.notification_integrations(tenant_id,provider,config,encrypted_secrets,updated_by)
    VALUES(${tenantId}::uuid,${provider},${config}::jsonb,${encrypted},${userId}::uuid)
    ON CONFLICT(tenant_id,provider) DO UPDATE SET config=EXCLUDED.config,encrypted_secrets=EXCLUDED.encrypted_secrets,enabled=false,enabled_at=NULL,verified_at=NULL,revision=gen_random_uuid(),updated_by=EXCLUDED.updated_by,updated_at=date_trunc('milliseconds',clock_timestamp()) RETURNING *`;
  return publicConnection(rows[0]);
}
export async function setEnabled(tenantId:string,provider:Provider,enabled:boolean) {
  const rows=await prisma.$queryRaw<Connection[]>`UPDATE global.notification_integrations SET enabled=${enabled},enabled_at=CASE WHEN ${enabled} THEN COALESCE(enabled_at,now()) ELSE NULL END,revision=gen_random_uuid(),updated_at=date_trunc('milliseconds',clock_timestamp())
    WHERE tenant_id=${tenantId}::uuid AND provider=${provider} AND (NOT ${enabled} OR verified_at IS NOT NULL) RETURNING *`;
  if(!rows.length)throw new ValidationError('Save and successfully test this connection before enabling it.');
  return publicConnection(rows[0]);
}
export async function disconnect(tenantId:string,provider:Provider) {
  await prisma.$executeRaw`DELETE FROM global.notification_integrations WHERE tenant_id=${tenantId}::uuid AND provider=${provider}`;
}
export async function deliveryHistory(tenantId:string,provider:Provider) {
  return prisma.$queryRaw`SELECT d.id,d.is_test AS "isTest",d.status,d.message,d.created_at AS "createdAt",d.completed_at AS "completedAt"
    FROM global.integration_deliveries d JOIN global.notification_integrations i ON i.id=d.integration_id
    WHERE i.tenant_id=${tenantId}::uuid AND i.provider=${provider} ORDER BY d.created_at DESC LIMIT 30`;
}

export function notificationText(note:Note,details:boolean,test:boolean) {
  if(test)return 'ComplianceCore connection test. Your notification connector is working.';
  return details?`${note.title}\n${note.body??''}`:`ComplianceCore: ${note.notification_type.replace(/_/g,' ')} (${note.priority}). Open ComplianceCore to view the details.`;
}
async function send(c:Connection,note:Note,test:boolean) {
  const secrets:Secrets=JSON.parse(decrypt(c.encrypted_secrets));
  const text=notificationText(note,c.config.includeDetails,test)+'\n'+env.FRONTEND_URL.replace(/\/$/,'')+'/notifications';
  if(c.provider==='slack')return postProvider(webhookUrl('slack',secrets.webhookUrl!),{text:text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')});
  if(c.provider==='teams')return postProvider(webhookUrl('teams',secrets.webhookUrl!),{type:'message',attachments:[{contentType:'application/vnd.microsoft.card.adaptive',contentUrl:null,content:{$schema:'http://adaptivecards.io/schemas/adaptive-card.json',type:'AdaptiveCard',version:'1.2',body:[{type:'TextBlock',text,wrap:true}]}}]});
  if(!note.email)throw new ValidationError('The recipient has no active organisation membership.');
  if(c.config.transport==='brevo')return postProvider(new URL('https://api.brevo.com/v3/smtp/email'),{sender:{email:c.config.from,name:'ComplianceCore'},to:[{email:note.email}],subject:test?'ComplianceCore connection test':'ComplianceCore notification',textContent:text},{'api-key':secrets.apiKey!});
  const target=await resolvePublic(c.config.host!);
  const transport=nodemailer.createTransport({host:target.address,port:c.config.port,secure:c.config.port===465,requireTLS:true,tls:{servername:c.config.host,rejectUnauthorized:true},auth:{user:secrets.username!,pass:secrets.password!},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000,disableFileAccess:true,disableUrlAccess:true});
  try{await transport.sendMail({from:c.config.from,to:note.email,subject:test?'ComplianceCore connection test':'ComplianceCore notification',text});}
  catch{throw new AppError('SMTP delivery could not be confirmed. Check TLS, credentials and whether your hosting provider allows outbound SMTP. Check the inbox before retrying.',502,'CONNECTOR_UNKNOWN');}
  finally{transport.close();}
}
async function deliver(c:Connection,note:Note,test=false) {
  const rows=await prisma.$queryRaw<{id:string}[]>`INSERT INTO global.integration_deliveries(integration_id,notification_id,is_test,status)
    VALUES(${c.id}::uuid,${test?null:note.id}::uuid,${test},'sending') ON CONFLICT(integration_id,notification_id) DO NOTHING RETURNING id`;
  if(!rows.length)return;
  const id=rows[0].id;
  try {
    await send(c,note,test);
    await prisma.$executeRaw`UPDATE global.integration_deliveries SET status='delivered',message='Provider accepted delivery.',completed_at=now() WHERE id=${id}::uuid`;
  }catch(error){
    const e=error instanceof AppError?error:new AppError('Connection failed. Check your settings and try a connection test.',502,'CONNECTOR_FAILED');
    await prisma.$executeRaw`UPDATE global.integration_deliveries SET status=${e.code==='CONNECTOR_UNKNOWN'?'unknown':'failed'},message=${e.message},completed_at=now() WHERE id=${id}::uuid`;
    if(test)throw e;
  }
}
export async function testIntegration(tenantId:string,provider:Provider,userId:string) {
  const c=await connection(tenantId,provider);
  const user=await prisma.user.findFirst({where:{id:userId,isActive:true,deletedAt:null},select:{email:true}});
  if(!user)throw new ValidationError('An active administrator is required.');
  try{await deliver(c,{id:'',user_id:userId,title:'Connection test',body:null,priority:'low',notification_type:'system',email:user.email},true);}
  catch(error){
    await prisma.$executeRaw`UPDATE global.notification_integrations SET verified_at=NULL,enabled=false,enabled_at=NULL,revision=gen_random_uuid() WHERE id=${c.id}::uuid AND revision=${c.revision}::uuid`;
    throw error;
  }
  const count=await prisma.$executeRaw`UPDATE global.notification_integrations SET verified_at=now() WHERE id=${c.id}::uuid AND revision=${c.revision}::uuid`;
  if(!count)throw new ValidationError('Settings changed during the test. Test the saved settings again.');
  return {message:'Provider accepted the test. Check the destination, then enable notifications.'};
}

// Poll durable tenant notifications after enabling; no historical flood, no
// provider call inside a business transaction, no automatic resend of uncertain
// requests. The unique claim prevents duplicate sends by concurrent instances.
export async function runIntegrationDelivery() {
  const connections=await prisma.$queryRaw<(Connection&{schema_name:string})[]>`SELECT i.*,t.schema_name FROM global.notification_integrations i JOIN global.tenants t ON t.id=i.tenant_id WHERE i.enabled AND i.verified_at IS NOT NULL AND t.is_active AND t.deleted_at IS NULL`;
  for(const c of connections){
    const notes=await withTenantSchema(c.schema_name,tx=>tx.$queryRaw<Note[]>`SELECT n.id,n.user_id,n.title,n.body,n.notification_type,n.priority,u.email
      FROM notifications n JOIN global.tenant_memberships m ON m.user_id=n.user_id AND m.tenant_id=${c.tenant_id}::uuid AND m.is_active AND m.deleted_at IS NULL
      JOIN global.users u ON u.id=n.user_id AND u.is_active AND u.deleted_at IS NULL
      WHERE n.created_at>=${c.enabled_at} AND n.created_at>now()-interval '24 hours' AND n.dismissed_at IS NULL
      AND n.notification_type=ANY(${c.config.events}::text[])
      AND (${c.provider}<>'email' OR NOT EXISTS(SELECT 1 FROM notification_preferences p WHERE p.user_id=n.user_id AND p.notification_type=n.notification_type AND p.email=false))
      AND NOT EXISTS(SELECT 1 FROM global.integration_deliveries d WHERE d.integration_id=${c.id}::uuid AND d.notification_id=n.id)
      ORDER BY n.created_at,n.id LIMIT 25`);
    for(const note of notes){
      const active=await prisma.$queryRaw<{enabled:boolean}[]>`SELECT enabled FROM global.notification_integrations WHERE id=${c.id}::uuid AND revision=${c.revision}::uuid`;
      if(!active[0]?.enabled)break;
      await deliver(c,note);
    }
  }
  await prisma.$executeRaw`UPDATE global.integration_deliveries SET status='unknown',message='Delivery was interrupted. Check the destination before sending another message.',completed_at=now() WHERE status='sending' AND created_at<now()-interval '5 minutes'`;
  await prisma.$executeRaw`DELETE FROM global.integration_deliveries WHERE created_at<now()-interval '90 days'`;
}
export function startIntegrationDelivery() {
  let running=false;
  const timer=setInterval(async()=>{if(running)return;running=true;try{await runIntegrationDelivery();}catch{logger.warn('Notification connector delivery could not run; check database migration and connection health.');}finally{running=false;}},30000);
  timer.unref();return ()=>clearInterval(timer);
}
