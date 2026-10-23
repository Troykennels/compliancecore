// Runs only against a dedicated loopback database with external transports off.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
const fixtureDir = path.join(os.tmpdir(),'compliance-presentation-20261023');
fs.mkdirSync(fixtureDir,{recursive:true});
const filename = path.join(fixtureDir,'private-env.json');
if (!fs.existsSync(filename)) {
  const pair = crypto.generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{type:'pkcs8',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}});
  fs.writeFileSync(filename,JSON.stringify({JWT_PRIVATE_KEY_BASE64:Buffer.from(pair.privateKey).toString('base64'),JWT_PUBLIC_KEY_BASE64:Buffer.from(pair.publicKey).toString('base64'),ENCRYPTION_KEY:crypto.randomBytes(32).toString('hex'),COOKIE_SECRET:crypto.randomBytes(32).toString('hex'),SIGNATURE_SECRET:crypto.randomBytes(32).toString('hex')}),{mode:0o600});
}
const args=process.argv.slice(2);
const payments=args[0]==='--db=payments';if(payments)args.shift();
const database=`postgresql://compliance_test@127.0.0.1:55443/compliance_renewal_task_${payments?'payments':'presentation'}_20261023`;
const env={...process.env,...JSON.parse(fs.readFileSync(filename,'utf8')),NODE_ENV:'test',PORT:'3008',FRONTEND_URL:'http://127.0.0.1:5178',DATABASE_URL:database,TEST_DATABASE_URL:database,ENABLE_REDIS:'false',REDIS_URL:'redis://127.0.0.1:1',SMTP_HOST:'127.0.0.1',SMTP_PORT:'1',SMTP_USER:'fixture',SMTP_PASS:'fixture',EMAIL_FROM:'ComplianceCore <demo@example.invalid>',EMAIL_REPLY_TO:'demo@example.invalid',BILLING_NOTIFY_EMAIL:'',BREVO_API_KEY:'',PAYSTACK_SECRET_KEY:'',PAYSTACK_PUBLIC_KEY:'',GROQ_API_KEY:'',AWS_ACCESS_KEY_ID:'fixture',AWS_SECRET_ACCESS_KEY:'fixture',AWS_S3_BUCKET:'fixture',AWS_REGION:'eu-west-1',PAYMENT_CURRENCIES:'NGN',S3_ENDPOINT:'http://127.0.0.1:1'};
env.AWS_S3_ENDPOINT='http://127.0.0.1:3019';env.AWS_S3_FORCE_PATH_STYLE='true';
env.DEMO_SEED_CONFIRM='orionsoftlimited';
for (const key of ['BREVO_API_KEY','PAYSTACK_SECRET_KEY','PAYSTACK_PUBLIC_KEY','GROQ_API_KEY','VAPID_PUBLIC_KEY','VAPID_PRIVATE_KEY','RENEWAL_DASHBOARD_API_KEY']) delete env[key];
env.GROQ_API_KEY='fixture-disabled';
const child=spawn(process.execPath,args,{env,stdio:'inherit',windowsHide:true});
child.on('exit',code=>{process.exitCode=code??1;});
