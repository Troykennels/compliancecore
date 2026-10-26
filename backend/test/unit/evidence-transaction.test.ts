import {beforeEach,describe,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({inTransaction:false,create:vi.fn(),version:vi.fn(),find:vi.fn(),log:vi.fn(),sign:vi.fn()}));
vi.mock('../../src/lib/prisma',()=>({withTenantSchema:async(_schema:unknown,callback:any)=>{m.inTransaction=true;try{return await callback({});}finally{m.inTransaction=false;}}}));
vi.mock('../../src/middleware/audit.middleware',()=>({setAuditSessionVars:vi.fn()}));
vi.mock('../../src/modules/evidence/evidence.repository',()=>({evidenceRepository:{create:m.create,createVersion:m.version,findById:m.find,logEvent:m.log}}));
vi.mock('../../src/lib/storage',()=>({evidenceFileKey:()=> 'fixture/file.pdf',generateUploadUrl:m.sign,ACCEPTED_MIME_TYPES:{'application/pdf':true}}));
vi.mock('../../src/jobs/ocr.job',()=>({enqueueOcrJob:vi.fn()}));
vi.mock('../../src/lib/email',()=>({email:{}}));
import {evidenceService} from '../../src/modules/evidence/evidence.service';
const actor={id:'person',email:'local@example.invalid',role:'owner',tenantId:'tenant'};
beforeEach(()=>{vi.resetAllMocks();m.inTransaction=false;m.create.mockResolvedValue({id:'evidence'});m.version.mockResolvedValue({id:'version'});m.find.mockResolvedValue({id:'evidence'});m.sign.mockImplementation(async()=>{expect(m.inTransaction).toBe(false);return {uploadUrl:'https://example.invalid/upload',expiresAt:new Date()};});});
describe('Evidence upload transaction boundaries',()=>{
 it('commits the initial record before generating its file URL',async()=>{const result=await evidenceService.initiateUpload('fixture',{title:'Proof',fileName:'file.pdf',fileSize:10,mimeType:'application/pdf',tagIds:[]},actor);expect(result.evidenceId).toBe('evidence');expect(m.sign).toHaveBeenCalledOnce();});
 it('commits a new version before generating its file URL',async()=>{const result=await evidenceService.initiateVersionUpload('fixture','evidence',{fileName:'file.pdf',fileSize:10,mimeType:'application/pdf'},actor);expect(result.versionId).toBe('version');expect(m.sign).toHaveBeenCalledOnce();});
 it('does not generate a URL when the database write fails',async()=>{m.version.mockRejectedValue(new Error('Database write failed'));await expect(evidenceService.initiateVersionUpload('fixture','evidence',{fileName:'file.pdf',fileSize:10,mimeType:'application/pdf'},actor)).rejects.toThrow('Database write failed');expect(m.sign).not.toHaveBeenCalled();});
});
