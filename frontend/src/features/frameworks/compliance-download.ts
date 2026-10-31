import { apiClient } from '@/lib/api-client';

/** Download a file from the API, using the server's filename when it sends one. */
export async function complianceDownload(url: string, fallback: string) {
  const res = await apiClient.get(url, { responseType: 'blob' });
  const disposition = String(res.headers['content-disposition'] ?? '');
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? fallback;
  const href = URL.createObjectURL(res.data as Blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
