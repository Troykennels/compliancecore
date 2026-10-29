import fs from 'node:fs';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
vi.mock('../../src/middleware/auth.middleware',()=>({authenticate:()=> (req:any,_res:any,next:any)=>{const role=req.get('x-test-role');req.user={id:'fixture-user',role,permissions:ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS]??[],tenantId:'fixture-tenant'};next();}}));
vi.mock('../../src/middleware/entitlement.middleware',()=>({enforceEntitlement:()=> (_req:any,_res:any,next:any)=>next(),enforceLimit:()=> (_req:any,_res:any,next:any)=>next()}));
vi.mock('../../src/modules/settings/settings.controller',()=>({settingsController:new Proxy({}, {get:()=> (_req:any,res:any)=>res.status(200).json({reachedController:true})})}));
import { ROLE_PERMISSIONS, hasPermission } from '../../src/middleware/rbac.middleware';
import router from '../../src/modules/settings/settings.router';
const app=express();app.use(express.json());app.use('/settings',router);app.use((error:any,_req:any,res:any,_next:any)=>res.status(error.statusCode??500).json({code:error.code}));
let server:ReturnType<typeof app.listen>,base:string;
beforeAll(async()=>{server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));base='http://127.0.0.1:'+(server.address() as AddressInfo).port;});afterAll(async()=>{await new Promise<void>(resolve=>server.close(()=>resolve()));});
describe('Real settings router permission boundaries (fixture identity only)',()=>{
 for(const [role,permissions] of Object.entries(ROLE_PERMISSIONS)) {
  it(role+' team-list access follows team:read',async()=>{const r=await fetch(base+'/settings/team/members',{headers:{'x-test-role':role}});expect(r.status).toBe(hasPermission(permissions,'team:read')?200:403);});
  for(const [method,url,body] of [['POST','/team/members/invite',{email:'new@example.invalid',role:'viewer'}],['PATCH','/team/members/fixture/role',{role:'viewer'}],['DELETE','/team/members/fixture',undefined]] as const){
   it(role+' '+method+' '+url+' follows team:write',async()=>{const r=await fetch(base+'/settings'+url,{method,headers:{'x-test-role':role,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});expect(r.status).toBe(hasPermission(permissions,'team:write')?200:403);});
  }
 }
 it('frontend and API permission sets agree for all eight roles',()=>{const source=fs.readFileSync('../frontend/src/config/role-permissions.ts','utf8');const front=JSON.parse(source.match(/rolePermissions:Record<UserRole,string\[\]>=(\{[\s\S]*?\});/)![1]);expect(Object.keys(front).sort()).toEqual(Object.keys(ROLE_PERMISSIONS).sort());for(const [role,p]of Object.entries(ROLE_PERMISSIONS))expect([...front[role]].sort()).toEqual([...p].sort());});
});
