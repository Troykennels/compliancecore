/** Phase grouping for the assessment steps, in the order the work is done. Unknown steps join the phase before them. */
export const PHASES:Array<{key:string;label:string;steps:string[]}>=[
 {key:'scope',label:'Scope',steps:['scope','obligations']},
 {key:'risk',label:'Risk assessment',steps:['risk_assessment','risk_treatment']},
 {key:'requirements',label:'Requirements and controls',steps:['soa','controls','policies']},
 {key:'evidence',label:'Evidence and checks',steps:['evidence','testing','corrective_actions']},
 {key:'review',label:'Review and reporting',steps:['internal_audit','management_review','monitoring','signoff','outcome']},
];
export function phaseOf(steps:string[],key:string):string {
 let phase=PHASES[0].key;
 for(const s of steps){const found=PHASES.find(p=>p.steps.includes(s));if(found)phase=found.key;if(s===key)return phase;}
 return phase;
}
