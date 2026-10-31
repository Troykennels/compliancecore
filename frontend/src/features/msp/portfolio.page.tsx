import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, ArrowRight, Search } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { useAuthStore } from '@/stores/auth.store';
import { ROLE_GUIDANCE } from '@/config/role-guidance';

export function MspPortfolioPage() {
  const { allTenants, activeTenant, switchTenant } = useAuthStore();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const permitted = allTenants.some((t) => ['msp_admin', 'msp_analyst'].includes(t.role));
  const clients = allTenants.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()));
  async function open(id: string) {
    setPending(id);
    try {
      if (id !== activeTenant?.id) await switchTenant(id);
      navigate('/dashboard');
    } catch {
      toast.error(
        'This workspace could not be opened. Check your membership or subscription with its administrator.',
      );
    } finally {
      setPending(null);
    }
  }
  if (!permitted)
    return (
      <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
        <PageHeader
          eyebrow="Service provider"
          title="Client portfolio"
          description="This page requires a service provider membership."
        />
        <p className="rounded-xl border bg-white p-6 text-sm text-slate-600">
          Ask your administrator to assign the correct service provider role. Client records are
          available only through an active organisation membership.
        </p>
      </div>
    );
  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
      <PageHeader
        eyebrow="Service provider"
        title="Client portfolio"
        description="Open the client workspaces your account is authorised to use. Each workspace keeps its records and permissions separate."
      />
      <div className="workspace-toolbar">
        <Search className="h-4 w-4 text-slate-400" aria-hidden="true" />
        <input
          className="min-w-0 flex-1 rounded-md border px-3 py-2 text-sm"
          aria-label="Search client workspaces"
          placeholder="Find an organisation"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="text-xs text-slate-500">{clients.length} workspaces</span>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {clients.map((client) => (
          <article
            key={client.id}
            className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5"
          >
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-brand-50 p-3 text-brand-700">
                <Building2 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h2 className="break-words font-semibold">{client.name}</h2>
                <p className="mt-1 text-xs text-slate-500">{ROLE_GUIDANCE[client.role].label}</p>
              </div>
            </div>
            {client.id === activeTenant?.id && (
              <p className="text-xs font-medium text-brand-700">Current workspace</p>
            )}
            <button
              disabled={pending !== null}
              onClick={() => void open(client.id)}
              className="mt-auto inline-flex items-center justify-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-800 hover:bg-brand-100 disabled:opacity-50"
            >
              {pending === client.id ? 'Opening…' : 'Open workspace'}
              <ArrowRight className="h-4 w-4" />
            </button>
          </article>
        ))}
      </div>
      {!clients.length && (
        <p className="rounded-xl border bg-white p-6 text-sm text-slate-500">
          No accessible workspace matches your search.
        </p>
      )}
    </div>
  );
}
