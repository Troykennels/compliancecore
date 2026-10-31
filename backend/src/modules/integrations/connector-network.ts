import https from 'node:https';
import { lookup } from 'node:dns/promises';
import type { LookupAddress } from 'node:dns';
import net from 'node:net';
import { AppError, ValidationError } from '../../lib/errors';

// Resolve once, reject private/reserved destinations, and pin that address for
// the actual connection. Validation followed by an unpinned fetch permits DNS rebinding.
export function publicAddress(address: string): boolean {
  if (net.isIP(address) === 4) {
    const [a,b] = address.split('.').map(Number);
    return !(a===0 || a===10 || a===127 || a>=224 || (a===169&&b===254) || (a===172&&b>=16&&b<=31) || (a===192&&(b===168||b===0||b===2)) || (a===198&&(b===18||b===19||b===51)) || (a===203&&b===0) || (a===100&&b>=64&&b<=127));
  }
  // Public global-unicast IPv6 only; this also rejects mapped IPv4 and loopback.
  return /^[23][0-9a-f]{3}:/i.test(address) && !/^2001:(db8|0*0|0*2|0*10|0*20):/i.test(address);
}
export async function resolvePublic(host: string) {
  if (net.isIP(host) || !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i.test(host) || !host.includes('.')) throw new ValidationError('Use a public provider hostname.');
  const addresses = await new Promise<LookupAddress[]>((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new ValidationError('Provider hostname lookup timed out. Check the hostname and try again.')),10000);
    lookup(host,{all:true,verbatim:true}).then(resolve,()=>reject(new ValidationError('Provider hostname could not be resolved. Check the hostname and try again.'))).finally(()=>clearTimeout(timer));
  });
  if (!addresses.length || addresses.some(a=>!publicAddress(a.address))) throw new ValidationError('Private or reserved network destinations are not allowed.');
  return addresses[0];
}
export function webhookUrl(provider: 'slack'|'teams', raw: string): URL {
  let url: URL;try{url=new URL(raw);}catch{throw new ValidationError('Enter a valid HTTPS webhook URL.');}
  const h=url.hostname.toLowerCase();
  const allowed=provider==='slack' ? h==='hooks.slack.com' || h==='hooks.slack-gov.com' : h.endsWith('.webhook.office.com') || h.endsWith('.logic.azure.com') || h.endsWith('.environment.api.powerplatform.com');
  if (!allowed || url.protocol!=='https:' || (url.port&&url.port!=='443') || url.username || url.password || url.hash || !url.pathname || url.pathname==='/') throw new ValidationError(`Use the ${provider==='slack'?'Slack incoming webhook':'Teams Workflow webhook'} HTTPS URL supplied by your provider.`);
  return url;
}
export async function postProvider(url: URL, payload: unknown, headers: Record<string,string> = {}): Promise<void> {
  const target=await resolvePublic(url.hostname);
  const body=JSON.stringify(payload);
  return new Promise((resolve,reject)=>{
    const request=https.request(url,{method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body),...headers},lookup:(_host,_options,callback)=>callback(null,target.address,target.family),timeout:15000},response=>{
      response.resume();
      const code=response.statusCode??0;
      // Never follow redirects with a secret webhook URL or provider credentials.
      response.on('end',()=>code>=200&&code<300?resolve():reject(new AppError(code===429?'Provider rate limit reached. Try again later.':`Provider rejected the request (HTTP ${code}). Check the connection settings.`,502,'CONNECTOR_REJECTED')));
      response.on('error',()=>reject(new AppError('Delivery could not be confirmed. Check the destination before trying again.',502,'CONNECTOR_UNKNOWN')));
    });
    request.on('timeout',()=>request.destroy(new Error('timeout')));
    const deadline=setTimeout(()=>request.destroy(new Error('timeout')),15000);
    deadline.unref();request.on('close',()=>clearTimeout(deadline));
    request.on('error',()=>reject(new AppError('Delivery could not be confirmed. Check the destination before trying again.',502,'CONNECTOR_UNKNOWN')));
    request.end(body);
  });
}
