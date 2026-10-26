import { complianceProfile } from './compliance-profiles';

export const scopeQuestions=[
 {key:'services',label:'What does your department do, and which services or processes are being assessed?',example:'Finance manages invoicing, payroll and monthly accounts.'},
 {key:'locations',label:'Which locations, systems, suppliers and countries are involved? What is outside scope?',example:'Head office, the payroll application and its cloud provider; overseas branches are excluded with a reason.'},
 {key:'parties',label:'Who depends on this work, and who did you consult?',example:'Staff, customers, IT, the data protection officer, suppliers and the finance director.'},
 {key:'obligations',label:'Which laws, contracts, regulator requests or customer commitments apply? Who will verify them?',example:'Record the source, applicable requirement, responsible person and any filing or contractual deadline.'},
 {key:'assets',label:'Which assets, records, activities or critical services need protection?',example:'Customer records, the finance system, administrator accounts and the payment supplier.'},
 {key:'data',label:'What sensitive information or critical outputs do you handle, and who could be harmed?',example:'Payroll and bank details; staff could suffer fraud or loss of privacy.'},
 {key:'current',label:'What checks and documents already exist? Where can we find proof?',example:'Approved policy, access reviews, backup logs and supplier contracts, with their record references.'},
 {key:'concerns',label:'What has gone wrong, or could go wrong? What changes are planned?',example:'A former employee retained access; a new payroll provider is being introduced.'},
 {key:'expectations',label:'What must this assessment achieve, and who accepts the agreed scope?',example:'Confirm payroll access meets policy; the finance director confirms the scope and required deadline.'},
];
export interface AssessmentRisk {
 id:string;asset_name:string|null;title:string;threat:string|null;vulnerability:string|null;consequence:string|null;
 owner_id:string|null;owner_active:boolean;rating_confirmed:boolean;assessment_basis:string|null;
 inherent_likelihood:number;inherent_impact:number;inherent_score:number;treatment:string;
 mitigation_plan:string|null;control_ids:string[];treatment_due_date:Date|string|null;acceptance_note:string|null;
 residual_likelihood:number;residual_impact:number;residual_score:number;residual_basis:string|null;status:string;
}
export function riskAssessed(r:AssessmentRisk):boolean {
 return Boolean(r.asset_name?.trim()&&r.title.trim()&&r.threat?.trim()&&r.consequence?.trim()&&r.owner_active&&r.rating_confirmed&&r.assessment_basis?.trim());
}
export function treatmentPlanned(r:AssessmentRisk):boolean {
 return riskAssessed(r)&&Boolean(r.mitigation_plan?.trim()&&r.treatment_due_date)&&(r.treatment==='mitigate'?r.control_ids.length>0:r.treatment==='accept'?Boolean(r.acceptance_note?.trim()):true);
}
export function residualReviewed(r:AssessmentRisk):boolean {return treatmentPlanned(r)&&['mitigated','accepted','closed'].includes(r.status)&&Boolean(r.residual_basis?.trim());}
interface Suggestion {assetName:string;assetType:string;title:string;threat:string;vulnerability:string;consequence:string;keywords:string[];likelihood:number;impact:number}
export function riskSuggestions(code:string,context:string,controls:Array<{id:string;control_ref:string;title:string}>) {
 const family=complianceProfile(code).family;
 const scenarios:Suggestion[]=family==='privacy'?[
  {assetName:'Personal-data processing activity',assetType:'Processing activity',title:'Personal data used beyond its agreed purpose',threat:'Unlawful or excessive processing',vulnerability:'Unclear lawful basis, retention or purpose restrictions',consequence:'Loss of privacy or rights, distress or discrimination',keywords:['lawful','consent','purpose','processing','privacy'],likelihood:3,impact:4},
  {assetName:'Customer or employee records',assetType:'Personal data',title:'Unauthorised disclosure of personal information',threat:'Unauthorised access or sharing',vulnerability:'Access, transfer or supplier safeguards may be inadequate',consequence:'Fraud, distress, financial loss or other harm to affected people',keywords:['access','security','transfer','processor','breach'],likelihood:3,impact:4},
  {assetName:'Data-subject request process',assetType:'Process',title:'A person cannot exercise their data rights',threat:'Missed or incorrectly handled request',vulnerability:'Unclear ownership, identity checks or deadline tracking',consequence:'Loss of individual rights and regulatory nonconformity',keywords:['rights','request','access','erasure'],likelihood:3,impact:3},
 ]:family==='financial'?[
  {assetName:'Financial reporting system',assetType:'Application',title:'Unauthorised financial journal or configuration change',threat:'Fraud or unauthorised change',vulnerability:'Excessive access or ineffective segregation of duties',consequence:'Material misstatement or unreliable financial reporting',keywords:['access','segregation','change','approval'],likelihood:3,impact:5},
  {assetName:'Financial reporting records',assetType:'Records',title:'Incomplete or inaccurate financial reporting data',threat:'Processing error or loss of records',vulnerability:'Reconciliation and recovery checks may be inadequate',consequence:'Incorrect accounts or inability to support audit evidence',keywords:['integrity','backup','operations','monitor'],likelihood:3,impact:4},
 ]:family==='continuity'?[
  {assetName:'Critical customer service',assetType:'Critical service',title:'Critical service unavailable beyond recovery tolerance',threat:'Site, technology or supplier disruption',vulnerability:'Untested recovery arrangements and dependencies',consequence:'Prolonged disruption, customer harm or contractual failure',keywords:['impact','recovery','continuity','exercise','supplier'],likelihood:3,impact:5},
  {assetName:'Critical staff and operating site',assetType:'People and site',title:'Key resources unavailable during disruption',threat:'Loss of staff, site or essential supplies',vulnerability:'Insufficient alternatives and escalation arrangements',consequence:'Failure to sustain prioritised services',keywords:['resource','continuity','response','plan'],likelihood:3,impact:4},
 ]:[
  {assetName:code==='PCIDSS'?'Cardholder data environment':'Customer information system',assetType:'Application and data',title:'Unauthorised access to sensitive records',threat:'Stolen credentials or excessive privilege',vulnerability:'Weak authentication or unreviewed permissions',consequence:'Disclosure, fraud, loss of integrity or service interruption',keywords:['access','authentication','identity','privilege'],likelihood:3,impact:4},
  {assetName:'Backup and recovery service',assetType:'Service',title:'Important records cannot be restored after disruption',threat:'Ransomware, accidental deletion or service failure',vulnerability:'Untested or insufficiently protected backups',consequence:'Data loss and prolonged service unavailability',keywords:['backup','recovery','restore','continuity'],likelihood:3,impact:4},
  {assetName:'External service provider',assetType:'Supplier',title:'Supplier failure exposes or disrupts the service',threat:'Supplier compromise or outage',vulnerability:'Unverified contractual, security or continuity commitments',consequence:'Loss of data, service availability or contractual assurance',keywords:['supplier','third','service provider','supply'],likelihood:3,impact:4},
 ];
 const assetContext=context.trim().slice(0,500);
 const namedAssets=context.split(/[,;\n]/).map(x=>x.trim()).filter(x=>x.length>=3&&x.length<=120);
 return scenarios.map((s,index)=>({...s,assetName:namedAssets[index]??s.assetName,context:assetContext||'No stakeholder asset inventory recorded yet. Confirm that this example exists in scope.',basis:'Illustrative starting values, not an assessment. Check that the scenario fits the suggested asset; review actual exposure and impact with the asset/process owner before confirming.',controls:controls.map(c=>({...c,matches:s.keywords.filter(k=>c.title.toLowerCase().includes(k)).length})).filter(c=>c.matches>0).sort((a,b)=>b.matches-a.matches||a.control_ref.localeCompare(b.control_ref)).slice(0,5).map(({matches:_matches,...c})=>c)}));
}
