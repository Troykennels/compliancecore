import { AsyncLocalStorage } from 'node:async_hooks';
import type { Prisma } from '@prisma/client';
export const auditRequestContext = new AsyncLocalStorage<{actor:()=>{id:string;role?:string|null}|undefined;requestId?:string}>();
export async function auditCurrentActor(tx:Prisma.TransactionClient):Promise<void>{
 const actor=auditRequestContext.getStore()?.actor();
 if(actor)await tx.$queryRaw`SELECT set_config('app.current_user_id',${actor.id},true),set_config('app.current_user_role',${actor.role??'system'},true)`;
}
