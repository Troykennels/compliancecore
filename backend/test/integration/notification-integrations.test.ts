import {describe,it,expect,vi,beforeAll,afterAll} from 'vitest';
import {execFileSync} from 'node:child_process';
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
const mocks=vi.hoisted(()=>({post:vi.fn(),send:vi.fn(),smtp:vi.fn()}));
vi.mock('../../src/modules/integrations/connector-network',async()=>({...await vi.importActual<object>('../../src/modules/integrations/connector-network'),resolvePublic:vi.fn(async()=>({address:'8.8.8.8',family:4})),postProvider:mocks.post}));
vi.mock('nodemailer',()=>({default:{createTransport:mocks.smtp}}));
const db=process.env.TEST_DATABASE_URL;
const backendDir=path.resolve(__dirname,'../..');
describe.skipIf(!db)('organisation notification connectors with real database and isolated provider doubles',()=>{
 let client:pg.Client;let tenant:string;let otherTenant:string;let user:string;let schema:string;
 let service:typeof import('../../src/modules/integrations/integrations.service');
 beforeAll(async()=>{
  client=new pg.Client({connectionString:db});await client.connect();
  await client.query('DROP SCHEMA IF EXISTS global CASCADE; DROP SCHEMA IF EXISTS framework_data CASCADE');
  execFileSync('node',['scripts/migrate.mjs'],{cwd:backendDir,env:{...process.env,DATABASE_URL:db},stdio:'pipe'});
  tenant=(await client.query("INSERT INTO global.tenants(name,slug,updated_at) VALUES('Connector fixture','connector-fixture',now()) RETURNING id")).rows[0].id;
  otherTenant=(await client.query("INSERT INTO global.tenants(name,slug,updated_at) VALUES('Other fixture','other-connector-fixture',now()) RETURNING id")).rows[0].id;
  user=(await client.query("INSERT INTO global.users(email,updated_at) VALUES('fixture@example.invalid',now()) RETURNING id")).rows[0].id;
  schema='tenant_'+tenant.replace(/-/g,'');await client.query('UPDATE global.tenants SET schema_name=$1 WHERE id=$2',[schema,tenant]);
  await client.query('INSERT INTO global.tenant_memberships(tenant_id,user_id,role) VALUES($1,$2,\'owner\')',[tenant,user]);
  await client.query(`CREATE SCHEMA "${schema}"`);
  const folder=path.join(backendDir,'../database/tenant-template');
  const templates=await Promise.all((await readdir(folder)).filter(f=>f.endsWith('.sql')).sort().map(f=>readFile(path.join(folder,f),'utf8')));
  await client.query(templates.join('\n').replaceAll('{{SCHEMA}}',schema));
  service=await import('../../src/modules/integrations/integrations.service');
  mocks.post.mockResolvedValue(undefined);mocks.send.mockResolvedValue({accepted:['fixture@example.invalid']});mocks.smtp.mockReturnValue({sendMail:mocks.send,close:vi.fn()});
 });
 afterAll(async()=>{await client?.end();const {prisma}=await import('../../src/lib/prisma');await prisma.$disconnect();});
 const settings={config:{events:['task_assigned'],includeDetails:false,transport:'smtp',port:587},secrets:{webhookUrl:'https://hooks.slack.com/services/fixture-secret'}};
 it('saves encrypted credentials, hides them and isolates organisations',async()=>{
  const result=await service.saveIntegration(tenant,'slack',user,settings);expect(result.enabled).toBe(false);expect(JSON.stringify(result)).not.toContain('fixture-secret');
  const row=(await client.query('SELECT encrypted_secrets FROM global.notification_integrations WHERE tenant_id=$1',[tenant])).rows[0];expect(row.encrypted_secrets).not.toContain('fixture-secret');
  expect(await service.listIntegrations(otherTenant)).toEqual([]);expect(await service.deliveryHistory(otherTenant,'slack')).toEqual([]);
  await expect(service.setEnabled(tenant,'slack',true)).rejects.toMatchObject({statusCode:422});
 });
 it('requires an actual successful test before enabling and records failed tests',async()=>{
  const {AppError}=await import('../../src/lib/errors');mocks.post.mockRejectedValueOnce(new AppError('Provider rejected the request',502,'CONNECTOR_REJECTED'));
  await expect(service.testIntegration(tenant,'slack',user)).rejects.toMatchObject({code:'CONNECTOR_REJECTED'});
  expect((await service.listIntegrations(tenant))[0].verifiedAt).toBeNull();
  await service.testIntegration(tenant,'slack',user);expect((await service.listIntegrations(tenant))[0].verifiedAt).not.toBeNull();
  await service.setEnabled(tenant,'slack',true);expect((await service.listIntegrations(tenant))[0].enabled).toBe(true);
 });
 async function note(type='task_assigned',offset="interval '0 seconds'"){
  return (await client.query(`INSERT INTO "${schema}".notifications(user_id,title,body,notification_type,created_at) VALUES($1,'Private title','Private body',$2,now()-${offset}) RETURNING id`,[user,type])).rows[0].id;
 }
 it('delivers only new selected notifications once, without details by default',async()=>{
  await note('task_assigned',"interval '2 days'");await note('calendar_reminder');await note();mocks.post.mockClear();
  await service.runIntegrationDelivery();await service.runIntegrationDelivery();expect(mocks.post).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(mocks.post.mock.calls[0])).not.toContain('Private title');
  expect(JSON.stringify(mocks.post.mock.calls[0])).toContain('task assigned');
 });
 it('pauses delivery and preserves secret fields across settings edits',async()=>{
  await service.setEnabled(tenant,'slack',false);await note();mocks.post.mockClear();await service.runIntegrationDelivery();expect(mocks.post).not.toHaveBeenCalled();
  const saved=await service.saveIntegration(tenant,'slack',user,{...settings,secrets:{}});expect(saved.configuredSecrets).toContain('webhookUrl');expect(saved.verifiedAt).toBeNull();expect(saved.enabled).toBe(false);
 });
 it('sends Teams Adaptive Card test payloads',async()=>{
  await service.saveIntegration(tenant,'teams',user,{...settings,secrets:{webhookUrl:'https://example.environment.api.powerplatform.com/workflows/test'}});
  mocks.post.mockClear();await service.testIntegration(tenant,'teams',user);expect(mocks.post.mock.calls[0][1]).toMatchObject({type:'message',attachments:[{contentType:'application/vnd.microsoft.card.adaptive',content:{type:'AdaptiveCard'}}]});
 });
 it('pauses a previously verified connection when a later test fails',async()=>{
  await service.setEnabled(tenant,'teams',true);const {AppError}=await import('../../src/lib/errors');mocks.post.mockRejectedValueOnce(new AppError('Delivery not confirmed',502,'CONNECTOR_UNKNOWN'));
  await expect(service.testIntegration(tenant,'teams',user)).rejects.toMatchObject({code:'CONNECTOR_UNKNOWN'});
  expect((await service.listIntegrations(tenant)).find(c=>c.provider==='teams')).toMatchObject({enabled:false,verifiedAt:null});
 });
 it('does not verify settings that changed while a test was in flight',async()=>{
  mocks.post.mockImplementationOnce(async()=>{await service.saveIntegration(tenant,'slack',user,{...settings,secrets:{}});});
  await expect(service.testIntegration(tenant,'slack',user)).rejects.toMatchObject({statusCode:422});
  expect((await service.listIntegrations(tenant)).find(c=>c.provider==='slack')?.verifiedAt).toBeNull();
 });
 it('pins SMTP to a public destination and enforces TLS; test mail only goes to the signed-in administrator',async()=>{
  await service.saveIntegration(tenant,'email',user,{config:{events:['task_assigned'],includeDetails:false,transport:'smtp',host:'smtp.example.com',port:587,from:'sender@example.invalid'},secrets:{username:'fixture-user',password:' fixture-password '}});
  await service.testIntegration(tenant,'email',user);expect(mocks.smtp.mock.calls.at(-1)?.[0]).toMatchObject({host:'8.8.8.8',requireTLS:true,tls:{servername:'smtp.example.com',rejectUnauthorized:true},auth:{pass:' fixture-password '}});expect(mocks.send.mock.calls.at(-1)?.[0].to).toBe('fixture@example.invalid');
 });
 it('respects email opt-outs and avoids a second platform email',async()=>{
  await service.setEnabled(tenant,'email',true);
  const {emailAllowed}=await import('../../src/modules/notifications/notification-preferences');expect(await emailAllowed(schema,user,'task_assigned')).toBe(false);
  await client.query(`INSERT INTO "${schema}".notification_preferences(user_id,notification_type,email) VALUES($1,'task_assigned',false)`,[user]);
  await note();mocks.send.mockClear();await service.runIntegrationDelivery();expect(mocks.send).not.toHaveBeenCalled();
  await service.setEnabled(tenant,'email',false);await client.query(`UPDATE "${schema}".notification_preferences SET email=true WHERE user_id=$1`,[user]);expect(await emailAllowed(schema,user,'task_assigned')).toBe(true);
 });
 it('disconnects without affecting another organisation',async()=>{
  await service.saveIntegration(tenant,'email',user,{config:{events:['task_assigned'],includeDetails:false,transport:'brevo',from:'sender@example.invalid'},secrets:{apiKey:'fixture-brevo-key'}});
  mocks.post.mockClear();await service.testIntegration(tenant,'email',user);expect(mocks.post.mock.calls[0][0].hostname).toBe('api.brevo.com');expect(mocks.post.mock.calls[0][1]).toMatchObject({sender:{email:'sender@example.invalid'},to:[{email:'fixture@example.invalid'}]});
  await service.disconnect(otherTenant,'slack');expect((await service.listIntegrations(tenant)).length).toBe(3);
  await service.disconnect(tenant,'slack');expect((await service.listIntegrations(tenant)).some(c=>c.provider==='slack')).toBe(false);expect(await service.deliveryHistory(tenant,'slack')).toEqual([]);
 });
});
