import { describe,it,expect } from 'vitest';
import { csvCell } from '../../src/lib/spreadsheet';
import { matchesFileSignature } from '../../src/lib/file-signature';
import { recommendFrameworks,scopingProfileSchema } from '../../src/modules/organizations/scoping';
describe('Untrusted spreadsheet exports',()=>{
 it('neutralises formulas behind whitespace/control prefixes, retaining numeric types',()=>{for(const v of ['=1+1',' +cmd','\t@SUM(A1)','\r-2+3'])expect(csvCell(v)).toContain("'");expect(csvCell(-12.4)).toBe('-12.4');expect(csvCell('normal, "quoted" text')).toBe('"normal, ""quoted"" text"');});
});
describe('Preview format checks',()=>{
 it('rejects executable markup and forged PDF/PNG bodies',()=>{expect(matchesFileSignature(Buffer.from('<script>alert(1)</script>'),'application/pdf')).toBe(false);expect(matchesFileSignature(Buffer.from('<svg></svg>'),'image/png')).toBe(false);expect(matchesFileSignature(Buffer.from('<html>'),'text/plain')).toBe(false);expect(matchesFileSignature(Buffer.from('%PDF-1.4\n'),'application/pdf')).toBe(true);expect(matchesFileSignature(Buffer.from('89504e470d0a1a0a','hex'),'image/png')).toBe(true);});
});
describe('Applicability suggestions require review',()=>{
 it('does not conclude GDPR, CCPA or HIPAA merely from region/data flags',()=>{const result=recommendFrameworks(scopingProfileSchema.parse({handlesPersonalData:true,handlesHealthData:true,operatingRegions:['eu','california','usa']}));for(const code of ['GDPR','CCPA','HIPAA']){const r=result.find(v=>v.code===code);expect(r).toBeDefined();expect(r!.priority).not.toBe('required');expect(r!.reason).toMatch(/review/i);}});
});
