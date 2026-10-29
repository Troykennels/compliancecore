import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import pg from 'pg';
import bcrypt from 'bcrypt';
import http from 'node:http';
import assert from 'node:assert/strict';
const privateFile=path.join(process.env.LOCALAPPDATA,'OrionSoft/compliance-workflow-20261026/readiness-access.private.json');
export async function localContext(){
 const data=JSON.parse(await fs.readFile(privateFile,'utf8'));
 const url=new URL(data.DATABASE_URL);assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,'55444');assert.equal(url.pathname,'/compliance_readiness_20261026');
 if(!data.env){const keys=crypto.generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{type:'pkcs8',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}});data.env={NODE_ENV:'test',PORT:'3009',FRONTEND_URL:'http://127.0.0.1:5175',DATABASE_URL:data.DATABASE_URL,PROVISIONING_DATABASE_URL:data.DATABASE_URL,REDIS_URL:'redis://127.0.0.1:6379',ENABLE_REDIS:'false',JWT_PRIVATE_KEY_BASE64:Buffer.from(keys.privateKey).toString('base64'),JWT_PUBLIC_KEY_BASE64:Buffer.from(keys.publicKey).toString('base64'),ENCRYPTION_KEY:crypto.randomBytes(32).toString('hex'),SMTP_HOST:'127.0.0.1',SMTP_PORT:'9',SMTP_USER:'',SMTP_PASS:'',COOKIE_SECRET:crypto.randomBytes(32).toString('hex'),SIGNATURE_SECRET:crypto.randomBytes(32).toString('hex'),AWS_ACCESS_KEY_ID:'local-test',AWS_SECRET_ACCESS_KEY:'local-test',AWS_S3_BUCKET:'readiness',AWS_S3_ENDPOINT:'http://127.0.0.1:3010',AWS_S3_FORCE_PATH_STYLE:'true',AWS_REGION:'us-east-1',OCR_PROVIDER:'none',GROQ_API_KEY:'local-disabled'};data.roles={};}
 const client=new pg.Client({connectionString:data.DATABASE_URL});await client.connect();
 for(const role of ['owner','admin','compliance_manager','control_owner','auditor','viewer','msp_admin','msp_analyst']){if(data.roles[role])continue;const id=crypto.randomUUID(),email=`readiness-${role}@example.invalid`,password=crypto.randomBytes(24).toString('base64url')+'Aa7!';await client.query('INSERT INTO global.users(id,email,password_hash,first_name,last_name,email_verified_at,updated_at,is_active) VALUES($1,$2,$3,$4,$5,NOW(),NOW(),true)',[id,email,await bcrypt.hash(password,10),'Readiness',role]);data.roles[role]={id,email,password};}
 await client.end();await fs.writeFile(privateFile,JSON.stringify(data));return data;
}
if(process.argv[2]==='server'){
 const data=await localContext();Object.assign(process.env,data.env);
 const blobs=new Map();const objectStore=http.createServer(async(req,res)=>{res.setHeader('Access-Control-Allow-Origin',data.env.FRONTEND_URL);res.setHeader('Access-Control-Allow-Headers','*');res.setHeader('Access-Control-Allow-Methods','GET,PUT,HEAD,OPTIONS');if(req.method==='OPTIONS'){res.writeHead(204);return res.end();}const key=new URL(req.url,'http://localhost').pathname;if(req.method==='PUT'){let chunks=[];for await(const part of req)chunks.push(part);const bytes=Buffer.concat(chunks);blobs.set(key,{bytes,type:req.headers['content-type']||'application/octet-stream'});res.setHeader('ETag','"'+crypto.createHash('md5').update(bytes).digest('hex')+'"');res.writeHead(200);return res.end();}const file=blobs.get(key);if(!file){res.writeHead(404);return res.end();}res.setHeader('Content-Type',file.type);res.setHeader('Content-Length',file.bytes.length);res.setHeader('ETag','"'+crypto.createHash('md5').update(file.bytes).digest('hex')+'"');res.writeHead(200);res.end(req.method==='HEAD'?undefined:file.bytes);});objectStore.listen(3010,'127.0.0.1');await import('../dist/server.js');
}else if(process.argv[2]==='setup'){const data=await localContext();Object.assign(process.env,data.env);await import('./bootstrap-billing.mjs');console.log('Isolated local identities and billing schema prepared; credentials kept private.');}
