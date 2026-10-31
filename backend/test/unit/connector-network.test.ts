import { describe,it,expect,vi } from 'vitest';
vi.mock('node:dns/promises',()=>({lookup:vi.fn()}));
import {lookup} from 'node:dns/promises';
import {publicAddress,resolvePublic,webhookUrl} from '../../src/modules/integrations/connector-network';
describe('connector destination restrictions',()=>{
 it.each(['127.0.0.1','10.1.2.3','169.254.169.254','172.16.1.1','192.168.0.1','100.100.1.1','::1','::ffff:127.0.0.1','fc00::1','fe80::1','2001:db8::1'])('rejects private or reserved address %s',ip=>expect(publicAddress(ip)).toBe(false));
 it.each(['8.8.8.8','1.1.1.1','2606:4700::1111'])('allows a public address %s',ip=>expect(publicAddress(ip)).toBe(true));
 it('rejects mixed public/private DNS answers',async()=>{vi.mocked(lookup).mockResolvedValue([{address:'8.8.8.8',family:4},{address:'127.0.0.1',family:4}] as never);await expect(resolvePublic('smtp.example.com')).rejects.toMatchObject({statusCode:422});});
 it('rejects literal SMTP IPs',async()=>{await expect(resolvePublic('127.0.0.1')).rejects.toMatchObject({statusCode:422});});
 it.each(['http://hooks.slack.com/services/test','https://hooks.slack.com.evil.test/services/test','https://user:pass@hooks.slack.com/services/test','https://hooks.slack.com:444/services/test'])('rejects webhook URL %s',url=>expect(()=>webhookUrl('slack',url)).toThrow());
 it('accepts provider webhook domains',()=>{expect(webhookUrl('slack','https://hooks.slack.com/services/test').hostname).toBe('hooks.slack.com');expect(webhookUrl('teams','https://example.environment.api.powerplatform.com/powerautomate/automations/direct/workflows/test').protocol).toBe('https:');});
});
