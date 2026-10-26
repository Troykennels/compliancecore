import { createHash } from 'node:crypto';

export interface ImplementationControl {
  id: string; control_ref: string; title: string; implementation_status: string;
  owner_id: string | null; owner_active: boolean; implementation_notes: string | null;
  testing_notes: string | null; last_reviewed_at: Date | string | null;
  review_frequency_days: number; current_evidence: number; due_date: Date | string | null;
}
export interface ImplementationPolicy {
  id: string; title: string; status: string; owner_id: string | null;
  owner_active: boolean; content: string | null; approved_by: string | null;
  approved_at: Date | string | null; review_due_date: Date | string | null;
}
export interface ImplementationGate { key: string; title: string; done: boolean; detail: string; href: string }
export function implementationGates(plan: unknown, controls: ImplementationControl[], policies: ImplementationPolicy[], now = Date.now()): ImplementationGate[] {
  const applicable = controls.filter(c => c.implementation_status !== 'not_applicable');
  const exclusions = controls.filter(c => c.implementation_status === 'not_applicable');
  const fresh = (c: ImplementationControl) => Boolean(c.last_reviewed_at) && new Date(c.last_reviewed_at!).getTime() + c.review_frequency_days * 86400000 > now;
  const policyReady = (p: ImplementationPolicy) => p.status === 'published' && p.owner_active && Boolean(p.owner_id && p.content?.trim() && p.approved_by && p.approved_at && p.review_due_date) && p.approved_by !== p.owner_id && new Date(p.review_due_date!).getTime() >= now;
  return [
    {key:'scope',title:'Agree scope and responsibility',done:Boolean(plan),detail:plan?'Scope, objective, owner and target recorded.':'Record the boundaries, intended outcome, accountable owner and target date.',href:'/frameworks'},
    {key:'controls',title:'Assess applicability and assign controls',done:controls.length>0 && applicable.length>0 && applicable.every(c=>c.owner_active && Boolean(c.owner_id)) && exclusions.every(c=>Boolean(c.implementation_notes?.trim())),detail:`${applicable.filter(c=>c.owner_active && c.owner_id).length}/${applicable.length} applicable controls assigned; ${exclusions.length} exclusions need a recorded reason.`,href:'/controls'},
    {key:'policies',title:'Approve and publish linked policies',done:policies.length>0 && policies.every(policyReady),detail:`${policies.filter(policyReady).length}/${policies.length} linked policies published with approval, owner and a current review date. At least one is required.`,href:'/policies'},
    {key:'implementation',title:'Complete the safeguards',done:applicable.length>0 && applicable.every(c=>c.implementation_status==='implemented' && Boolean(c.implementation_notes?.trim())),detail:`${applicable.filter(c=>c.implementation_status==='implemented' && c.implementation_notes?.trim()).length}/${applicable.length} applicable controls implemented with notes.`,href:'/controls'},
    {key:'evidence',title:'Attach current evidence',done:applicable.length>0 && applicable.every(c=>Number(c.current_evidence)>0),detail:`${applicable.filter(c=>Number(c.current_evidence)>0).length}/${applicable.length} applicable controls have active, completed-upload evidence that has not expired.`,href:'/evidence'},
    {key:'testing',title:'Test and review the controls',done:applicable.length>0 && applicable.every(c=>Boolean(c.testing_notes?.trim()) && fresh(c)),detail:`${applicable.filter(c=>c.testing_notes?.trim() && fresh(c)).length}/${applicable.length} applicable controls have test notes and a current recorded review.`,href:'/controls'},
  ];
}
export function implementationSnapshot(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
export function effectiveImplementationStatus(plan: {status:string;review_hash:string|null;review_due_at:Date|string|null}|null, hash:string, gates:ImplementationGate[]): string {
  if (!plan) return 'not_started';
  if (plan.status==='implemented' && (plan.review_hash!==hash || gates.some(g=>!g.done) || !plan.review_due_at || new Date(plan.review_due_at).getTime()<=Date.now())) return 'needs_attention';
  if (plan.status==='in_review' && (plan.review_hash!==hash || gates.some(g=>!g.done))) return 'needs_attention';
  if (plan.status==='in_progress' && gates.every(g=>g.done)) return 'ready_for_review';
  return plan.status;
}
