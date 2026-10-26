// Explicitly isolated local fixture; never accepts a production connection string.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
const keys=JSON.parse(fs.readFileSync(path.join(os.tmpdir(),'compliance-presentation-20261023/private-env.json'),'utf8'));
const db='postgresql://compliance_test@127.0.0.1:55443/compliance_renewal_task_workflow_20261026';
const env={...process.env,...keys,NODE_ENV:'test',PORT:'3008',FRONTEND_URL:'http://127.0.0.1:5179',DATABASE_URL:db,TEST_DATABASE_URL:db,ENABLE_REDIS:'false',REDIS_URL:'redis://127.0.0.1:1',SMTP_HOST:'127.0.0.1',SMTP_PORT:'1',SMTP_USER:'fixture',SMTP_PASS:'fixture',EMAIL_FROM:'Demo <demo@example.invalid>',AWS_ACCESS_KEY_ID:'fixture',AWS_SECRET_ACCESS_KEY:'fixture',AWS_S3_BUCKET:'fixture',AWS_REGION:'eu-west-1',AWS_S3_ENDPOINT:'http://127.0.0.1:3019',AWS_S3_FORCE_PATH_STYLE:'true',GROQ_API_KEY:'fixture-disabled'};
for(const name of ['BREVO_API_KEY','PAYSTACK_SECRET_KEY','PAYSTACK_PUBLIC_KEY','VAPID_PUBLIC_KEY','VAPID_PRIVATE_KEY','RENEWAL_DASHBOARD_API_KEY','ORION_LICENSE_API_KEY'])delete env[name];
const child=spawn(process.execPath,process.argv.slice(2),{env,stdio:'inherit',windowsHide:true});
child.on('exit',code=>{process.exitCode=code??1;});
