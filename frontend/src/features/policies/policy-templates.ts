import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import type { ApiResponse } from '@/types/api';
export interface PolicyTemplate {id:string;title:string;purpose:string;families:string[];requirements:string[];records:string[];content:string;documentType:'policy'}
export function usePolicyTemplates(){return useQuery({queryKey:['policy-templates'],queryFn:()=>apiClient.get<ApiResponse<PolicyTemplate[]>>('/policies/templates').then(r=>r.data.data),staleTime:3600000});}
export async function downloadPolicyTemplate(id:string){try{const r=await apiClient.get(`/policies/templates/${id}/download`,{responseType:'blob'});const url=URL.createObjectURL(r.data);const a=document.createElement('a');a.href=url;a.download=id+'-policy-template.docx';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch{toast.error('The Word template could not be downloaded. Please retry.');}}
