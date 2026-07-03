import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { organizationApi } from '../api/organization.api';
import type { UpdateOrganizationDto } from '../types/organization.types';

export const ORG_QUERY_KEY = ['organization', 'profile'] as const;

export function useOrganizationProfile() {
  return useQuery({
    queryKey: ORG_QUERY_KEY,
    queryFn: () => organizationApi.getProfile().then((r) => r.data.data.organization),
  });
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: UpdateOrganizationDto) =>
      organizationApi.updateProfile(dto).then((r) => r.data.data.organization),
    onSuccess: (organization) => {
      queryClient.setQueryData(ORG_QUERY_KEY, organization);
      toast.success('Organisation profile updated.');
    },
    onError: () => {
      toast.error('Failed to update organisation profile. Please try again.');
    },
  });
}
