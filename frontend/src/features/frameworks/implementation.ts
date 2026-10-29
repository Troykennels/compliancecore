import type { ComplianceProfile } from './assessment';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { ApiResponse } from '@/types/api';
import { toast } from 'sonner';
export interface Implementation {
 framework:{id:string;code:string;name:string;short_name:string|null;library_count:number};
 plan:null|{scope:string;objective:string;owner_id:string;target_date:string;status:string;submitted_by:string|null;approved_by:string|null;approved_at:string|null;review_due_at:string|null;review_note:string|null;preparation:{baseline?:string;risks?:string;managementReview?:string;internalAuditId?:string|null;trainingProgramId?:string|null;obligations?:string;riskMethod?:string;assessmentPeriod?:string;monitoring?:string}};
 profile:ComplianceProfile;
 status:string;progress:number;
 gates:Array<{key:string;title:string;done:boolean;detail:string;href:string}>;
 stats:{controls:number;applicable:number;implemented:number;evidenced:number;unassigned:number;overdue:number};
 controls:Array<{id:string;controlRef:string;title:string;status:string;ownerId:string|null;ownerName:string|null;hasEvidence:boolean;reviewedAt:string|null}>;
 policies:Array<{id:string;title:string;status:string;reviewDueDate:string|null}>;
 soa:Array<{control_id:string;applicable:boolean;justification:string;decided_by:string;decided_at:string;supporting_evidence_id?:string|null}>;
 events?:Array<{action:string;actor_id:string;created_at:string;note:string|null}>;
 auditOptions?:Array<{id:string;title:string;status:string}>;
 trainingOptions?:Array<{id:string;title:string;status:string}>;
}
export const implementationLabels:Record<string,string>={not_started:'Not started',planning:'Scope recorded',in_progress:'Assessment in progress',ready_for_review:'Ready for independent review',in_review:'Awaiting independent sign-off',implemented:'Assessment reviewed',needs_attention:'Review required — records changed'};
export function useImplementationOverview(){return useQuery({queryKey:['implementation','overview'],queryFn:()=>apiClient.get<ApiResponse<Implementation[]>>('/frameworks/implementation-overview').then(r=>r.data.data),refetchInterval:60000});}
export function useImplementation(id:string){return useQuery({queryKey:['implementation',id],queryFn:()=>apiClient.get<ApiResponse<Implementation>>(`/frameworks/${id}/implementation`).then(r=>r.data.data),enabled:Boolean(id)});}
export function useImplementationMembers(enabled=true){return useQuery({queryKey:['implementation-members'],queryFn:()=>apiClient.get<ApiResponse<Array<{id:string;name:string;role?:string}>>>('/frameworks/implementation-members').then(r=>r.data.data),enabled});}
export function useImplementationAction(id:string){const qc=useQueryClient();return useMutation({mutationFn:({path='',data,method='post'}:{path?:string;data?:unknown;method?:'post'|'put'})=>apiClient[method](`/frameworks/${id}/implementation${path}`,data),onSuccess:()=>{for(const key of ['implementation','frameworks','controls','policies','dashboard','tasks'])void qc.invalidateQueries({queryKey:[key]});toast.success('Assessment record updated.');},onError:(e:{response?:{data?:{error?:{message?:string}}}})=>toast.error(e.response?.data?.error?.message??'Could not save the assessment. Please retry.')});}
