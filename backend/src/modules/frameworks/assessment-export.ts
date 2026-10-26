import ExcelJS from 'exceljs';
import type { assessmentService } from './assessment.service';

export async function assessmentWorkbook(data:Awaited<ReturnType<typeof assessmentService.get>>) {
 const book=new ExcelJS.Workbook();book.creator='ComplianceCore';book.created=new Date();
 function sheet(name:string,columns:Array<[string,string,number]>) {
  const s=book.addWorksheet(name,{views:[{state:'frozen',ySplit:1,xSplit:2}]});
  s.columns=columns.map(([header,key,width])=>({header,key,width}));
  s.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};s.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF243B63'}};
  s.getRow(1).height=32;s.autoFilter={from:{row:1,column:1},to:{row:1,column:columns.length}};
  s.pageSetup={orientation:'landscape',paperSize:9,fitToPage:true,fitToWidth:1,fitToHeight:0,printTitlesRow:'1:1'};
  return s;
 }
 const risk=sheet('Risk register',[
  ['Record ID','id',38],['Asset or activity','asset',28],['Type','type',20],['Risk','risk',40],['Threat or event','threat',35],['Weakness','weakness',35],['Consequence / harm','consequence',42],
  ['Likelihood 1–5','l',16],['Impact 1–5','i',16],['Inherent score','score',16],['Treatment','treatment',18],['Candidate / selected controls','controls',50],['Treatment plan','plan',48],['Owner','owner',25],['Due date','due',16],
  ['Residual likelihood','rl',19],['Residual impact','ri',18],['Residual score','rs',16],['Remaining-risk rationale','residual',45],['Ratings confirmed','confirmed',20],['Assessment basis','basis',45],['Status','status',20],['Acceptance decision','acceptance',40]
 ]);
 for(const r of data.risks){const row=risk.addRow({id:r.id,asset:r.asset_name,type:r.asset_type,risk:r.title,threat:r.threat,weakness:r.vulnerability,consequence:r.consequence,l:r.inherent_likelihood,i:r.inherent_impact,treatment:r.treatment,controls:r.control_ids.map(id=>{const c=data.controls.find(c=>c.id===id);return c?c.control_ref+' — '+c.title:'Unresolved control '+id;}).join('\n'),plan:r.mitigation_plan,owner:r.owner_name,due:r.treatment_due_date?new Date(r.treatment_due_date).toISOString().slice(0,10):'',rl:r.residual_likelihood,ri:r.residual_impact,residual:r.residual_basis,confirmed:r.rating_confirmed?'Yes':'No — draft',basis:r.assessment_basis,status:r.status,acceptance:r.acceptance_note});row.getCell('score').value={formula:`H${row.number}*I${row.number}`,result:r.inherent_score};row.getCell('rs').value={formula:`P${row.number}*Q${row.number}`,result:r.residual_score};}
 // One editable blank row when the register is empty; examples are not business facts.
 if(!data.risks.length)risk.addRow({confirmed:'No — draft'});
 for(let i=2;i<=Math.max(102,risk.rowCount);i++)for(const col of ['H','I','P','Q'])risk.getCell(`${col}${i}`).dataValidation={type:'whole',operator:'between',formulae:[1,5],allowBlank:true,showErrorMessage:true,error:'Enter a whole number from 1 to 5.'};
 const engagement=sheet('Stakeholder consultation',[['Stakeholder','person',25],['Department','department',25],['Date','date',16],['Status','status',16],...data.questions.map(q=>[q.label,q.key,50] as [string,string,number])]);
 for(const e of data.engagements)engagement.addRow({person:e.stakeholder,department:e.department,date:new Date(e.consulted_on).toISOString().slice(0,10),status:e.status,...e.answers});
 const guide=sheet('Read me and rating scale',[['Item','item',32],['Explanation','explanation',110]]);
 guide.addRows([{item:'Framework',explanation:data.framework.name},{item:'Purpose',explanation:'Stakeholder scoping, risk assessment and treatment decisions. This workbook is an export for review and editing; changes in Excel do not automatically update the app.'},{item:'Framework focus',explanation:data.profile.focus},{item:'Outcome',explanation:data.profile.outcomeDetail},{item:'Edition check',explanation:data.profile.editionNote??'Verify the current authoritative requirements and organisational scope. The app library is an assessment aid, not proof of complete standard coverage.'},{item:'Rating method',explanation:data.ratingGuide.method},...data.ratingGuide.likelihood.map(explanation=>({item:'Likelihood',explanation})),...data.ratingGuide.impact.map(explanation=>({item:'Impact',explanation})),{item:'Control suggestions',explanation:'Candidates come only from this framework’s saved controls using title keywords. Confirm applicability and suitability; they are not authoritative crosswalks or automatic risk acceptance.'},{item:'Applicability record',explanation:data.profile.applicabilityLabel+' follows risk assessment and treatment decisions. Non-applicability needs evidence and must never bypass mandatory obligations.'},{item:'Official reference',explanation:data.profile.source}]);
 for(const s of book.worksheets){s.eachRow((row,n)=>{if(n>1){row.alignment={vertical:'top',wrapText:true};row.eachCell(cell=>{cell.border={bottom:{style:'hair',color:{argb:'FFDDE3ED'}}};});}});}
 return book.xlsx.writeBuffer();
}
