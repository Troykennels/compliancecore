// Frontend-only release from a clean revision. Provider credentials stay outside source.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
const repo=path.resolve(import.meta.dirname,'../..');
const privateRoot=path.join(process.env.LOCALAPPDATA,'OrionSoft/ComplianceCore-private-20261023');
const folder=path.join(privateRoot,'reference-release-20261031');
const evidence=path.join(repo,'verification/reference-20261031');
await fs.mkdir(folder,{recursive:true});await fs.mkdir(evidence,{recursive:true});
const target=JSON.parse(await fs.readFile(path.join(privateRoot,'vercel-target.private.json'),'utf8'));
assert.equal(target.projectId,'prj_Toi3vZFuaWT66u14pWT99DRHw3Iv');
const cli=path.join(process.env.LOCALAPPDATA,'npm-cache/_npx/67eb4586ca667318/node_modules/vercel/dist/index.js');
async function command(executable,args,options={}){
  let output='';const code=await new Promise((resolve,reject)=>{const child=spawn(executable,args,{cwd:options.cwd??repo,env:{...process.env,VERCEL_PROJECT_ID:target.projectId,VERCEL_ORG_ID:target.orgId},windowsHide:true,stdio:['ignore','pipe','pipe']});child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);child.on('error',reject);child.on('close',resolve);});
  await fs.writeFile(path.join(folder,options.log??'command.private.log'),output);assert.equal(code,0,'Command failed; inspect its private release log.');return output;
}
async function api(route){const auth=JSON.parse(await fs.readFile(path.join(process.env.APPDATA,'com.vercel.cli/Data/auth.json'),'utf8'));const response=await fetch('https://api.vercel.com'+route,{headers:{Authorization:'Bearer '+auth.token}});assert(response.ok,'Vercel metadata request failed: '+response.status);return response.json();}
const record=path.join(folder,'release.private.json');
const action=process.argv[2];
if(action==='prepare'){
  const commit=(await command('git',['rev-parse','HEAD'])).trim();assert.match(commit,/^[a-f0-9]{40}$/);
  const source=path.join(folder,'source-'+commit.slice(0,12)),archive=source+'.tar';
  await command('git',['archive','--format=tar','--output='+archive,commit]);
  await fs.mkdir(source);await command('tar.exe',['-xf',archive,'-C',source]);
  await fs.mkdir(path.join(source,'frontend/.vercel'));await fs.writeFile(path.join(source,'frontend/.vercel/project.json'),JSON.stringify(target));
  const alias=await api(`/v4/aliases/compliancecore-sand.vercel.app?teamId=${target.orgId}`);
  await fs.writeFile(record,JSON.stringify({commit,source,previousFrontend:alias.deployment.id}));console.log(JSON.stringify({prepared:true,commit,previousFrontend:alias.deployment.id}));
}else{
  const release=JSON.parse(await fs.readFile(record,'utf8'));
  if(action==='build'){
    await command(process.execPath,[cli,'deploy','--prod','--skip-domain','--yes','--json','--build-env','VITE_API_URL=https://compliancecore-api-production.up.railway.app','--build-env','VITE_APP_ENV=production','--meta','sourceCommit='+release.commit],{cwd:path.join(release.source,'frontend'),log:'build.private.log'});
  }
  const deployments=await api(`/v6/deployments?projectId=${target.projectId}&teamId=${target.orgId}&limit=15`);
  const candidates=deployments.deployments.filter(d=>d.meta?.sourceCommit===release.commit).map(d=>({id:d.uid,url:d.url,state:d.state}));
  if(action==='promote'){
    const candidate=candidates.find(d=>d.state==='READY');assert(candidate,'No ready build for this source.');
    const health=await fetch('https://compliancecore-api-production.up.railway.app/health');assert(health.ok,'API health check failed.');
    await command(process.execPath,[cli,'promote','https://'+candidate.url,'--yes','--timeout','3m'],{cwd:path.join(release.source,'frontend'),log:'promote.private.log'});
    const alias=await api(`/v4/aliases/compliancecore-sand.vercel.app?teamId=${target.orgId}`);assert.equal(alias.deployment.id,candidate.id);
    await fs.writeFile(path.join(evidence,'deployment.json'),JSON.stringify({commit:release.commit,frontendDeployment:candidate.id,previousFrontend:release.previousFrontend,promoted:true,url:'https://compliancecore-sand.vercel.app',backendUnchanged:true,at:new Date().toISOString()},null,2));
    console.log(JSON.stringify({promoted:true,commit:release.commit,...candidate}));
  }else console.log(JSON.stringify(candidates));
}
