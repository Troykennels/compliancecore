import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Loader2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';

// Branding on every plan, Essential included (prompt section 11): legal name,
// logo, footer line, colour and an optional letterhead image. Images are PNG
// or JPEG under 350 KB (the formats every PDF can show), checked again by the
// server, and saved one at a time so a request never gets too large. Address
// and contact details come from the company profile below.

interface Branding {
  name: string; legalName: string | null; address: string | null; phone: string | null; website: string | null;
  footer: string | null; color: string | null; logo: string | null; letterhead: string | null;
}

const MAX_BYTES = 350 * 1024;

function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!['image/png', 'image/jpeg'].includes(file.type)) { reject(new Error('Use a PNG or JPEG image (SVG is not accepted).')); return; }
    if (file.size > MAX_BYTES) { reject(new Error('The image must be under 350 KB.')); return; }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('That file could not be read.'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

function getMessage(err: unknown): string {
  const e = err as { response?: { data?: { error?: { message?: string } } } };
  return e?.response?.data?.error?.message ?? 'Could not save the branding.';
}

export function BrandingSettings({ canWrite }: { canWrite: boolean }): JSX.Element {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<Branding | null>({
    queryKey: ['organization', 'branding'],
    queryFn: async () => (await apiClient.get('/organizations/branding')).data.data,
  });
  const [form, setForm] = useState({ legalName: '', footer: '', color: '' });
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (data) setForm({ legalName: data.legalName ?? '', footer: data.footer ?? '', color: data.color ?? '' });
  }, [data]);

  async function save(body: Record<string, unknown>, what: string) {
    setSaving(what);
    try {
      const r = await apiClient.put('/organizations/branding', body);
      qc.setQueryData(['organization', 'branding'], r.data.data);
      toast.success('Branding saved. It now appears on your reports and documents.');
    } catch (err) {
      toast.error(getMessage(err));
    } finally {
      setSaving(null);
    }
  }

  async function pick(e: React.ChangeEvent<HTMLInputElement>, field: 'logo' | 'letterhead') {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try { await save({ [field]: await readImage(file) }, field); } catch (err) { toast.error((err as Error).message); }
  }

  if (isLoading) return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-indigo-600" aria-hidden="true" /></div>;

  const name = form.legalName || data?.name || 'Your organisation';
  const contact = [data?.address, data?.phone, data?.website].filter(Boolean).join('  |  ');
  const field = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500';

  return (
    <fieldset disabled={!canWrite} className="space-y-5">
      <p className="text-sm text-slate-600">Shown on your executive report, policy and record downloads, and the Bill to section of your invoices. Included in every plan.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="brand-legal" className="mb-1 block text-sm font-medium text-slate-700">Legal organisation name</label>
          <input id="brand-legal" className={field} maxLength={255} value={form.legalName} placeholder={data?.name} onChange={(e) => setForm({ ...form, legalName: e.target.value })} />
        </div>
        <div>
          <label htmlFor="brand-color" className="mb-1 block text-sm font-medium text-slate-700">Brand colour</label>
          <div className="flex items-center gap-2">
            <input id="brand-color" type="color" value={form.color || '#2563EB'} onChange={(e) => setForm({ ...form, color: e.target.value.toUpperCase() })} className="h-9 w-12 rounded border border-slate-300" />
            <span className="font-mono text-xs text-slate-600">{form.color || 'Default'}</span>
            {form.color && <button type="button" onClick={() => setForm({ ...form, color: '' })} className="text-xs text-rose-600 hover:underline">Reset</button>}
          </div>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="brand-footer" className="mb-1 block text-sm font-medium text-slate-700">Footer line (optional)</label>
          <input id="brand-footer" className={field} maxLength={300} value={form.footer} placeholder="e.g. RC 123456 · Regulated by ..." onChange={(e) => setForm({ ...form, footer: e.target.value })} />
        </div>
      </div>
      <div>
        <button type="button" onClick={() => save({ legalName: form.legalName, footer: form.footer, color: form.color || null }, 'text')} disabled={saving !== null} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
          {saving === 'text' ? 'Saving...' : 'Save name, footer and colour'}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {(['logo', 'letterhead'] as const).map((f) => (
          <div key={f} className="rounded-lg border border-slate-200 p-3">
            <p className="text-sm font-medium text-slate-700">{f === 'logo' ? 'Logo' : 'Letterhead image (optional, replaces the header)'}</p>
            <div className="mt-2 flex h-20 items-center justify-center rounded bg-slate-50">
              {data?.[f] ? <img src={data[f]!} alt={f === 'logo' ? 'Logo' : 'Letterhead'} className="max-h-20 max-w-full object-contain" /> : <Building2 className="h-6 w-6 text-slate-300" aria-hidden="true" />}
            </div>
            <div className="mt-2 flex items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-1 text-sm font-semibold text-indigo-700 hover:underline">
                <Upload className="h-4 w-4" aria-hidden="true" /> {saving === f ? 'Saving...' : data?.[f] ? 'Replace' : 'Upload'}
                <input type="file" accept="image/png,image/jpeg" className="sr-only" onChange={(e) => pick(e, f)} />
              </label>
              {data?.[f] && <button type="button" onClick={() => save({ [f]: null }, f)} className="inline-flex items-center gap-1 text-xs text-rose-600 hover:underline"><X className="h-3 w-3" aria-hidden="true" /> Remove</button>}
            </div>
            <p className="mt-1 text-xs text-slate-500">PNG or JPEG, under 350 KB.</p>
          </div>
        ))}
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Preview</p>
        <div className="max-w-xl overflow-hidden rounded-lg border border-slate-200 bg-white" data-testid="branding-preview">
          {data?.letterhead ? (
            <img src={data.letterhead} alt="Letterhead preview" className="max-h-28 w-full object-contain p-2" />
          ) : (
            <div className="flex items-center gap-3 p-4 text-white" style={{ background: form.color || '#2563EB' }}>
              {data?.logo && <img src={data.logo} alt="" className="h-10 w-10 rounded bg-white object-contain p-0.5" />}
              <div className="min-w-0">
                <p className="truncate font-bold">{name}</p>
                <p className="text-xs opacity-90">Executive Compliance Report</p>
                {contact && <p className="truncate text-xs opacity-80">{contact}</p>}
              </div>
            </div>
          )}
          <div className="px-4 py-6 text-xs text-slate-400">The document content appears here.</div>
          <div className="border-t border-slate-200 px-4 py-2 text-center text-[11px] text-slate-500">
            {form.footer && <span className="block">{form.footer}</span>}
            ComplianceCore by ORION SOFT LIMITED, prepared for {name}
          </div>
        </div>
      </div>
    </fieldset>
  );
}
