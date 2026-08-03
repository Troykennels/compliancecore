import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Check, ShieldCheck, Info } from 'lucide-react';
import { organizationApi } from '../api/organization.api';
import { frameworksApi } from '@/features/frameworks/api/frameworks.api';
import {
  EMPTY_SCOPING_PROFILE, REGION_LABELS, DRIVER_LABELS, HOSTING_LABELS,
  type ScopingProfile, type ScopingRegion, type FrameworkRecommendation,
  type HostingModel, type PrimaryDriver,
} from '../types/scoping.types';

const PRIORITY_STYLES: Record<FrameworkRecommendation['priority'], string> = {
  required:    'bg-rose-100 text-rose-700',
  recommended: 'bg-amber-100 text-amber-700',
  optional:    'bg-slate-100 text-slate-600',
};

const PRIORITY_LABEL: Record<FrameworkRecommendation['priority'], string> = {
  required:    'Required',
  recommended: 'Recommended',
  optional:    'Optional',
};

interface Props {
  /** Rendered inside onboarding (compact, with a skip affordance) vs. settings. */
  variant?: 'onboarding' | 'settings';
  onDone?: () => void;
}

/**
 * Compliance scoping questionnaire.
 *
 * Every question is about how the business operates — never about a standard.
 * An owner who has never done compliance can answer all of them; mapping the
 * answers onto frameworks is the platform's job, not theirs.
 */
export function ScopingQuestionnaire({ variant = 'onboarding', onDone }: Props): JSX.Element {
  const [profile, setProfile] = useState<ScopingProfile>(EMPTY_SCOPING_PROFILE);
  const [recommendations, setRecommendations] = useState<FrameworkRecommendation[] | null>(null);

  // Pre-fill from a previously saved answer set (settings, or a resumed signup).
  const existing = useQuery({
    queryKey: ['organization', 'scoping'],
    queryFn: () => organizationApi.getScoping().then((r) => r.data.data),
  });
  const savedProfile = existing.data?.profile;
  const [hydrated, setHydrated] = useState(false);
  if (savedProfile && !hydrated) {
    setProfile(savedProfile);
    setRecommendations(existing.data?.recommendations ?? null);
    setHydrated(true);
  }

  const frameworksQuery = useQuery({
    queryKey: ['frameworks', 'list'],
    queryFn: () => frameworksApi.list().then((r) => r.data.data),
    enabled: recommendations !== null,
  });

  const save = useMutation({
    mutationFn: () => organizationApi.saveScoping(profile).then((r) => r.data.data),
    onSuccess: (data) => setRecommendations(data.recommendations),
    onError: () => toast.error('Could not save your answers. Please try again.'),
  });

  const adopt = useMutation({
    mutationFn: (frameworkId: string) => frameworksApi.adopt(frameworkId).then((r) => r.data.data),
    onSuccess: (res) => {
      toast.success(
        res.created > 0
          ? `Added ${res.created} controls to your programme.`
          : 'Already adopted — no new controls to add.',
      );
      void frameworksQuery.refetch();
    },
    onError: () => toast.error('Could not adopt that framework.'),
  });

  const set = <K extends keyof ScopingProfile>(key: K, value: ScopingProfile[K]) =>
    setProfile((p) => ({ ...p, [key]: value }));

  const toggleRegion = (field: 'operatingRegions' | 'customerDataRegions', region: ScopingRegion) =>
    setProfile((p) => ({
      ...p,
      [field]: p[field].includes(region)
        ? p[field].filter((r) => r !== region)
        : [...p[field], region],
    }));

  // ── Results ────────────────────────────────────────────────────────────────
  if (recommendations) {
    const byCode = new Map((frameworksQuery.data ?? []).map((f) => [f.code, f]));

    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Based on your answers, these apply to you
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Adopting a framework copies its controls into your programme so you can work through
            them. You can change this at any time.
          </p>
        </div>

        <ul className="space-y-2">
          {recommendations.map((rec) => {
            const fw = byCode.get(rec.code);
            const alreadyAdopted = (fw?.adoptedControlCount ?? 0) > 0;
            return (
              <li key={rec.code} className="rounded-lg border border-slate-200 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${PRIORITY_STYLES[rec.priority]}`}>
                    {PRIORITY_LABEL[rec.priority]}
                  </span>
                  <span className="text-sm font-medium text-slate-900">{fw?.name ?? rec.code}</span>
                  {fw && fw.libraryControlCount > 0 && (
                    <span className="text-xs text-slate-400">{fw.libraryControlCount} controls</span>
                  )}
                  <div className="ml-auto">
                    {!fw ? (
                      <span className="text-xs text-slate-400">Not in catalogue</span>
                    ) : alreadyAdopted ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                        <Check className="h-3.5 w-3.5" /> Adopted
                      </span>
                    ) : fw.libraryControlCount === 0 ? (
                      // Be straight about coverage rather than adopting nothing silently.
                      <span className="text-xs text-slate-400">Controls coming soon</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => adopt.mutate(fw.id)}
                        disabled={adopt.isPending}
                        className="rounded-md border border-indigo-300 px-3 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
                      >
                        Adopt
                      </button>
                    )}
                  </div>
                </div>
                <p className="mt-1 text-xs text-slate-600">{rec.reason}</p>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setRecommendations(null)}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Change my answers
          </button>
          {onDone && (
            <button
              type="button"
              onClick={onDone}
              className="ml-auto rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              {variant === 'onboarding' ? 'Go to my dashboard' : 'Done'}
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Questionnaire ──────────────────────────────────────────────────────────
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
      className="space-y-5"
    >
      <div className="flex items-start gap-2 rounded-lg border border-indigo-200 bg-indigo-50 p-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
        <p className="text-xs text-indigo-900">
          A few questions about how your organisation operates. We use them to work out which
          regulations and standards actually apply to you, so you are not staring at a list of
          eighteen frameworks wondering which ones matter.
        </p>
      </div>

      <Section title="Where do you operate?" hint="Select every country or region where you have customers, staff or offices.">
        <ChipGroup
          options={REGION_LABELS}
          selected={profile.operatingRegions}
          onToggle={(v) => toggleRegion('operatingRegions', v)}
        />
      </Section>

      <Section title="Whose personal data do you hold?" hint="Data-protection law follows the person, not your company address — this usually matters more than where you are based.">
        <ChipGroup
          options={REGION_LABELS}
          selected={profile.customerDataRegions}
          onToggle={(v) => toggleRegion('customerDataRegions', v)}
        />
      </Section>

      <Section title="What kind of information do you handle?">
        <div className="space-y-2">
          <Toggle label="Personal data about individuals (names, emails, addresses…)"
            checked={profile.handlesPersonalData} onChange={(v) => set('handlesPersonalData', v)} />
          <Toggle label="Card payments — we take payments by debit or credit card"
            checked={profile.handlesCardPayments} onChange={(v) => set('handlesCardPayments', v)} />
          <Toggle label="Health or medical information"
            checked={profile.handlesHealthData} onChange={(v) => set('handlesHealthData', v)} />
          <Toggle label="Financial account or transaction data"
            checked={profile.handlesFinancialData} onChange={(v) => set('handlesFinancialData', v)} />
          <Toggle label="Data about children"
            checked={profile.handlesChildrenData} onChange={(v) => set('handlesChildrenData', v)} />
        </div>
      </Section>

      <Section title="How do you run the business?">
        <div className="space-y-2">
          <Toggle label="We build our own software or product"
            checked={profile.buildsSoftware} onChange={(v) => set('buildsSoftware', v)} />
          <Toggle label="We sell to large companies or government"
            checked={profile.sellsToEnterprise} onChange={(v) => set('sellsToEnterprise', v)} />
          <Toggle label="We use third-party suppliers who handle our data"
            checked={profile.usesSubprocessors} onChange={(v) => set('usesSubprocessors', v)} />
          <Toggle label="Staff work remotely"
            checked={profile.hasRemoteWorkers} onChange={(v) => set('hasRemoteWorkers', v)} />
          <Toggle label="Downtime would seriously damage the business"
            checked={profile.businessContinuityCritical} onChange={(v) => set('businessContinuityCritical', v)} />
          <Toggle label="We are a regulated financial institution"
            checked={profile.isRegulatedFinancialInstitution} onChange={(v) => set('isRegulatedFinancialInstitution', v)} />
          <Toggle label="We are listed on a public stock exchange"
            checked={profile.isPubliclyListed} onChange={(v) => set('isPubliclyListed', v)} />
          <Toggle label="We have a Data Protection Officer"
            checked={profile.hasDataProtectionOfficer} onChange={(v) => set('hasDataProtectionOfficer', v)} />
        </div>
      </Section>

      <div className="grid gap-4 sm:grid-cols-2">
        <Section title="Where do your systems run?">
          <select
            value={profile.hostingModel}
            onChange={(e) => set('hostingModel', e.target.value as HostingModel)}
            className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
          >
            {HOSTING_LABELS.map((h) => <option key={h.value} value={h.value}>{h.label}</option>)}
          </select>
        </Section>

        <Section title="What is driving this?">
          <select
            value={profile.primaryDriver}
            onChange={(e) => set('primaryDriver', e.target.value as PrimaryDriver)}
            className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
          >
            {DRIVER_LABELS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </Section>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={save.isPending}
          className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          Show what applies to me
        </button>
        {variant === 'onboarding' && onDone && (
          <button
            type="button"
            onClick={onDone}
            className="text-sm font-medium text-slate-500 hover:text-slate-700"
          >
            Skip for now
          </button>
        )}
      </div>
    </form>
  );
}

// ── Building blocks ──────────────────────────────────────────────────────────

function Section({ title, hint, children }: {
  title: string; hint?: string; children: React.ReactNode;
}): JSX.Element {
  return (
    <div>
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      {hint && <p className="mb-2 mt-0.5 text-xs text-slate-500">{hint}</p>}
      <div className={hint ? '' : 'mt-2'}>{children}</div>
    </div>
  );
}

function ChipGroup<T extends string>({ options, selected, onToggle }: {
  options: { value: T; label: string }[];
  selected: T[];
  onToggle: (value: T) => void;
}): JSX.Element {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = selected.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onToggle(o.value)}
            aria-pressed={on}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              on
                ? 'border-indigo-600 bg-indigo-600 text-white'
                : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Toggle({ label, checked, onChange }: {
  label: string; checked: boolean; onChange: (v: boolean) => void;
}): JSX.Element {
  return (
    <label className="flex cursor-pointer items-start gap-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
      />
      <span className="text-sm text-slate-700">{label}</span>
    </label>
  );
}
