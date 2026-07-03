import { apiClient } from '@/lib/api-client';
import type {
  ReportFilter, ExecutiveDashboard,
  ScheduledReport, CreateScheduledReportDto, UpdateScheduledReportDto,
} from '../types/reports.types';

function filterToParams(filter: ReportFilter): Record<string, string> {
  const p: Record<string, string> = {};
  if (filter.days)     p['days']     = String(filter.days);
  if (filter.dateFrom) p['dateFrom'] = filter.dateFrom;
  if (filter.dateTo)   p['dateTo']   = filter.dateTo;
  return p;
}

export const reportsApi = {
  getDashboard(filter: ReportFilter = {}) {
    return apiClient.get<{ data: ExecutiveDashboard }>('/reports/dashboard', { params: filterToParams(filter) });
  },

  async downloadPdf(filter: ReportFilter = {}): Promise<void> {
    const params = new URLSearchParams(filterToParams(filter)).toString();
    const resp = await apiClient.get<Blob>(`/reports/export/pdf${params ? '?' + params : ''}`, {
      responseType: 'blob',
    });
    const url = URL.createObjectURL(resp.data as unknown as Blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compliance-report-${new Date().toISOString().slice(0, 10)}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  },

  async downloadExcel(filter: ReportFilter = {}): Promise<void> {
    const params = new URLSearchParams(filterToParams(filter)).toString();
    const resp = await apiClient.get<Blob>(`/reports/export/excel${params ? '?' + params : ''}`, {
      responseType: 'blob',
    });
    const url = URL.createObjectURL(resp.data as unknown as Blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compliance-report-${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  },

  listScheduled() {
    return apiClient.get<{ data: ScheduledReport[] }>('/reports/scheduled');
  },

  createScheduled(dto: CreateScheduledReportDto) {
    return apiClient.post<{ data: ScheduledReport }>('/reports/scheduled', dto);
  },

  updateScheduled(id: string, dto: UpdateScheduledReportDto) {
    return apiClient.patch<{ data: ScheduledReport }>(`/reports/scheduled/${id}`, dto);
  },

  deleteScheduled(id: string) {
    return apiClient.delete<{ data: null }>(`/reports/scheduled/${id}`);
  },
};
