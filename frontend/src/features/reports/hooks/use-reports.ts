import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { reportsApi } from '../api/reports.api';
import type { ReportFilter, CreateScheduledReportDto, UpdateScheduledReportDto } from '../types/reports.types';

export const REPORT_KEYS = {
  dashboard: (filter: ReportFilter) => ['reports', 'dashboard', filter] as const,
  scheduled: () => ['reports', 'scheduled'] as const,
};

export function useExecutiveDashboard(filter: ReportFilter = {}) {
  return useQuery({
    queryKey: REPORT_KEYS.dashboard(filter),
    queryFn: () => reportsApi.getDashboard(filter).then((r) => r.data.data),
    staleTime: 5 * 60 * 1000, // 5 min
  });
}

export function useDownloadPdf(filter: ReportFilter = {}) {
  return useMutation({
    mutationFn: () => reportsApi.downloadPdf(filter),
    onSuccess: () => toast.success('PDF report downloaded.'),
    onError: () => toast.error('PDF export failed. Please try again.'),
  });
}

export function useDownloadExcel(filter: ReportFilter = {}) {
  return useMutation({
    mutationFn: () => reportsApi.downloadExcel(filter),
    onSuccess: () => toast.success('Excel report downloaded.'),
    onError: () => toast.error('Excel export failed. Please try again.'),
  });
}

export function useScheduledReports() {
  return useQuery({
    queryKey: REPORT_KEYS.scheduled(),
    queryFn: () => reportsApi.listScheduled().then((r) => r.data.data),
  });
}

export function useCreateScheduledReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateScheduledReportDto) => reportsApi.createScheduled(dto).then((r) => r.data.data),
    onSuccess: () => {
      toast.success('Scheduled report created.');
      qc.invalidateQueries({ queryKey: REPORT_KEYS.scheduled() });
    },
    onError: () => toast.error('Failed to create scheduled report.'),
  });
}

export function useUpdateScheduledReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateScheduledReportDto }) =>
      reportsApi.updateScheduled(id, dto).then((r) => r.data.data),
    onSuccess: () => {
      toast.success('Scheduled report updated.');
      qc.invalidateQueries({ queryKey: REPORT_KEYS.scheduled() });
    },
    onError: () => toast.error('Failed to update scheduled report.'),
  });
}

export function useDeleteScheduledReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => reportsApi.deleteScheduled(id),
    onSuccess: () => {
      toast.success('Scheduled report deleted.');
      qc.invalidateQueries({ queryKey: REPORT_KEYS.scheduled() });
    },
    onError: () => toast.error('Failed to delete scheduled report.'),
  });
}
