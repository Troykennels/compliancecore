import {beforeEach,describe,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({verify:vi.fn(),exists:vi.fn(),revoked:vi.fn(),membership:vi.fn(),user:vi.fn()}));
vi.mock('../../src/lib/jwt',()=>({verifyAccessToken:m.verify}));
vi.mock('../../src/config/redis',()=>({redis:{exists:m.exists},REDIS_KEYS:{revokedToken:(id:string)=>id}}));
vi.mock('../../src/lib/token-revocation',()=>({isTokenRevoked:m.revoked}));
vi.mock('../../src/lib/prisma',()=>({prisma:{tenantMembership:{findFirst:m.membership},user:{findFirst:m.user}}}));
import {authenticate} from '../../src/middleware/auth.middleware';
const token={sub:'user',email:'local@example.invalid',tenantId:'tenant',role:'viewer',permissions:['*'],jti:'jti',iat:1,exp:2,isSuperadmin:false};
beforeEach(()=>{vi.resetAllMocks();m.verify.mockReturnValue({...token});m.exists.mockResolvedValue(0);m.revoked.mockResolvedValue(false);m.membership.mockResolvedValue({role:'viewer'});m.user.mockResolvedValue({id:'user'});});
async function invoke(){const req:any={headers:{authorization:'Bearer fixture'}};const next=vi.fn();await authenticate()(req,{} as any,next);return {req,next};}
describe('Fresh access checks on every authenticated route',()=>{
 it('uses current role permissions instead of stale token permissions',async()=>{const {req,next}=await invoke();expect(next).toHaveBeenCalledWith();expect(req.user.permissions).not.toContain('*');expect(req.user.permissions).toContain('controls:read');});
 it('blocks a removed membership',async()=>{m.membership.mockResolvedValue(null);const {req,next}=await invoke();expect(req.user).toBeUndefined();expect(next.mock.calls[0][0].statusCode).toBe(403);});
 it('blocks a token issued before a role change',async()=>{m.membership.mockResolvedValue({role:'control_owner'});const {next}=await invoke();expect(next.mock.calls[0][0].message).toContain('access changed');});
 it('checks active user and membership together',async()=>{await invoke();expect(m.membership).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({isActive:true,deletedAt:null,user:{isActive:true,deletedAt:null}})}));});
 it('checks an unassigned onboarding account is still active',async()=>{m.verify.mockReturnValue({...token,tenantId:null,role:null});m.user.mockResolvedValue(null);const {req,next}=await invoke();expect(req.user).toBeUndefined();expect(next.mock.calls[0][0].statusCode).toBe(401);});
 it('requires the platform administrator flag to remain current',async()=>{m.verify.mockReturnValue({...token,isSuperadmin:true});m.user.mockResolvedValue(null);const {req,next}=await invoke();expect(req.user).toBeUndefined();expect(next.mock.calls[0][0].statusCode).toBe(403);});
 it('returns a retryable error when revocation storage is unavailable',async()=>{m.exists.mockRejectedValue(new Error('Redis unavailable'));const {req,next}=await invoke();expect(req.user).toBeUndefined();expect(next.mock.calls[0][0].statusCode).toBe(503);});
 it('does not continue when membership verification fails',async()=>{m.membership.mockRejectedValue(new Error('Database unavailable'));const {req,next}=await invoke();expect(req.user).toBeUndefined();expect(next.mock.calls[0][0].message).toBe('Database unavailable');});
});
