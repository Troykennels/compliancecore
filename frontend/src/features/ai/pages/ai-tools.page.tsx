import React, { useState } from 'react';
import {
  FileText, ShieldCheck, AlertTriangle, ListChecks,
  MessageSquare, Search, Sparkles, Loader2, Copy, Check,
  ChevronRight, Download,
} from 'lucide-react';
import {
  useSummarizeContract, useGeneratePolicy, useAnalyzeRisk,
  useGenerateChecklist, useDocumentQa, useAiSearch,
} from '../hooks/use-ai';
import type { RiskLevel, ChecklistItem } from '../types/ai.types';

// ── Shared helpers ─────────────────────────────────────────────────────────────

type Tab = 'contract' | 'policy' | 'risk' | 'checklist' | 'docqa' | 'search';

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'contract',  label: 'Contract Summarizer',  icon: FileText },
  { id: 'policy',    label: 'Policy Generator',      icon: ShieldCheck },
  { id: 'risk',      label: 'Risk Analyzer',         icon: AlertTriangle },
  { id: 'checklist', label: 'Checklist Generator',   icon: ListChecks },
  { id: 'docqa',     label: 'Document Q&A',          icon: MessageSquare },
  { id: 'search',    label: 'AI Search',             icon: Search },
];

function LoadingOverlay({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16">
      <Loader2 className="h-9 w-9 animate-spin text-blue-500" />
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button onClick={copy} className="flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
      {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="mb-1 block text-xs font-medium text-slate-700">{children}</label>;
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
    />
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 resize-none"
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 bg-white"
    />
  );
}

function RunButton({ loading, children }: { loading: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
      {loading ? 'Analysing…' : children}
    </button>
  );
}

// ── Risk helpers ───────────────────────────────────────────────────────────────

const RISK_LABELS: Record<RiskLevel, string> = {
  very_low: 'Very Low', low: 'Low', medium: 'Medium', high: 'High', very_high: 'Very High',
};

const RISK_COLORS: Record<RiskLevel, string> = {
  very_low: 'bg-green-100 text-green-700',
  low:      'bg-emerald-100 text-emerald-700',
  medium:   'bg-amber-100 text-amber-700',
  high:     'bg-orange-100 text-orange-700',
  very_high:'bg-red-100 text-red-700',
};

function riskScoreColor(score: number) {
  if (score <= 4)  return 'text-green-600 bg-green-50';
  if (score <= 9)  return 'text-amber-600 bg-amber-50';
  if (score <= 16) return 'text-orange-600 bg-orange-50';
  return 'text-red-600 bg-red-50';
}

// ── 1. Contract Summarizer ─────────────────────────────────────────────────────

function ContractSummarizer() {
  const [evidenceId, setEvidenceId] = useState('');
  const [focusAreas, setFocusAreas] = useState('');
  const { mutate, isPending, data } = useSummarizeContract();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutate({
      evidenceId: evidenceId.trim(),
      focusAreas: focusAreas ? focusAreas.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
    });
  };

  return (
    <div className="space-y-5">
      <form onSubmit={onSubmit} className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div>
          <Label>Evidence ID (UUID of the uploaded contract)</Label>
          <Input
            value={evidenceId}
            onChange={(e) => setEvidenceId(e.target.value)}
            placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
            required
          />
          <p className="mt-1 text-[11px] text-slate-400">Navigate to Evidence, open the contract, and copy the ID from the URL.</p>
        </div>
        <div>
          <Label>Focus Areas (optional, comma-separated)</Label>
          <Input
            value={focusAreas}
            onChange={(e) => setFocusAreas(e.target.value)}
            placeholder="e.g. payment terms, termination clauses, liability"
          />
        </div>
        <RunButton loading={isPending}>Summarise Contract</RunButton>
      </form>

      {isPending && <LoadingOverlay message="Reading and analysing the contract…" />}

      {data && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">Analysis Complete</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">{(data.wordCount ?? 0).toLocaleString()} words</span>
              <CopyButton text={[data.summary ?? '', '\n\nKey Terms:\n' + (data.keyTerms ?? []).map((t) => '• ' + t).join('\n'), '\nObligations:\n' + (data.obligations ?? []).map((o) => '• ' + o).join('\n'), '\nRisks:\n' + (data.risks ?? []).map((r) => '• ' + r).join('\n')].join('')} />
            </div>
          </div>

          <ResultCard title="Executive Summary">
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{data.summary}</p>
          </ResultCard>

          <div className="grid grid-cols-2 gap-4">
            <ResultCard title="Key Terms">
              <ul className="space-y-1.5">
                {(data.keyTerms ?? []).map((t, i) => <BulletItem key={i}>{t}</BulletItem>)}
              </ul>
            </ResultCard>
            <ResultCard title="Obligations">
              <ul className="space-y-1.5">
                {(data.obligations ?? []).map((o, i) => <BulletItem key={i}>{o}</BulletItem>)}
              </ul>
            </ResultCard>
            <ResultCard title="Identified Risks" accent="red">
              <ul className="space-y-1.5">
                {(data.risks ?? []).map((r, i) => <BulletItem key={i} dot="red">{r}</BulletItem>)}
              </ul>
            </ResultCard>
            <ResultCard title="Dates & Deadlines" accent="amber">
              {(data.expiryDates ?? []).length ? (
                <ul className="space-y-1.5">
                  {(data.expiryDates ?? []).map((d, i) => <BulletItem key={i} dot="amber">{d}</BulletItem>)}
                </ul>
              ) : <p className="text-xs text-slate-400">No dates identified</p>}
            </ResultCard>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 2. Policy Generator ────────────────────────────────────────────────────────

const POLICY_TYPES = [
  'Information Security Policy', 'Data Protection & Privacy Policy', 'Access Control Policy',
  'Incident Response Policy', 'Business Continuity Policy', 'Acceptable Use Policy',
  'Change Management Policy', 'Vendor Management Policy', 'Risk Management Policy',
  'Password & Authentication Policy', 'Data Retention & Disposal Policy', 'Remote Work Policy',
];

const FRAMEWORKS = ['ISO 27001', 'SOC 2 Type II', 'GDPR', 'HIPAA', 'PCI DSS', 'NIST CSF', 'NIST SP 800-53', 'CIS Controls', 'FedRAMP', 'CCPA'];

function PolicyGenerator() {
  const [policyType, setPolicyType]       = useState(POLICY_TYPES[0]);
  const [customPolicy, setCustomPolicy]   = useState('');
  const [useCustom, setUseCustom]         = useState(false);
  const [framework, setFramework]         = useState('');
  const [orgName, setOrgName]             = useState('');
  const [scope, setScope]                 = useState('');
  const [context, setContext]             = useState('');
  const { mutate, isPending, data }       = useGeneratePolicy();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutate({
      policyType:        useCustom ? customPolicy : policyType,
      framework:         framework || undefined,
      organizationName:  orgName || undefined,
      scope:             scope || undefined,
      additionalContext: context || undefined,
    });
  };

  const downloadPolicy = () => {
    if (!data) return;
    const blob = new Blob([data.policy], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.title.replace(/\s+/g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <form onSubmit={onSubmit} className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label>Policy Type</Label>
            <div className="flex items-center gap-2 mb-2">
              <button type="button" onClick={() => setUseCustom(false)}
                className={`text-xs rounded-full px-3 py-1 font-medium ${!useCustom ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}>
                Predefined
              </button>
              <button type="button" onClick={() => setUseCustom(true)}
                className={`text-xs rounded-full px-3 py-1 font-medium ${useCustom ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}>
                Custom
              </button>
            </div>
            {useCustom
              ? <Input value={customPolicy} onChange={(e) => setCustomPolicy(e.target.value)} placeholder="e.g. Third-Party Risk Management Policy" required />
              : <Select value={policyType} onChange={(e) => setPolicyType(e.target.value)}>
                  {POLICY_TYPES.map((p) => <option key={p}>{p}</option>)}
                </Select>
            }
          </div>
          <div>
            <Label>Framework (optional)</Label>
            <Select value={framework} onChange={(e) => setFramework(e.target.value)}>
              <option value="">None</option>
              {FRAMEWORKS.map((f) => <option key={f}>{f}</option>)}
            </Select>
          </div>
          <div>
            <Label>Organisation Name (optional)</Label>
            <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Acme Corp" />
          </div>
          <div className="col-span-2">
            <Label>Scope (optional)</Label>
            <Input value={scope} onChange={(e) => setScope(e.target.value)} placeholder="e.g. All employees, contractors, and third-party vendors" />
          </div>
          <div className="col-span-2">
            <Label>Additional Context (optional)</Label>
            <Textarea value={context} onChange={(e) => setContext(e.target.value)} rows={2} placeholder="Industry, specific requirements, existing controls…" />
          </div>
        </div>
        <RunButton loading={isPending}>Generate Policy</RunButton>
      </form>

      {isPending && <LoadingOverlay message="Drafting your compliance policy…" />}

      {data && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">{data.title}</h3>
            <div className="flex items-center gap-2">
              <CopyButton text={data.policy} />
              <button onClick={downloadPolicy} className="flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
                <Download className="h-3.5 w-3.5" /> Download .md
              </button>
            </div>
          </div>
          {data.sections.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {data.sections.map((s, i) => (
                <span key={i} className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-medium text-blue-700">{s}</span>
              ))}
            </div>
          )}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 max-h-[480px] overflow-y-auto">
            <pre className="text-xs text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">{data.policy}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 3. Risk Analyzer ──────────────────────────────────────────────────────────

const INDUSTRIES = [
  'Financial Services', 'Healthcare', 'Technology', 'Retail', 'Manufacturing',
  'Government', 'Education', 'Energy & Utilities', 'Telecommunications', 'Legal Services',
];

function RiskAnalyzer() {
  const [title, setTitle]         = useState('');
  const [description, setDesc]    = useState('');
  const [context, setContext]     = useState('');
  const [industry, setIndustry]   = useState('');
  const { mutate, isPending, data } = useAnalyzeRisk();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutate({ riskTitle: title, riskDescription: description, context: context || undefined, industry: industry || undefined });
  };

  return (
    <div className="space-y-5">
      <form onSubmit={onSubmit} className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div>
          <Label>Risk Title *</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Unauthorised access to customer PII" required />
        </div>
        <div>
          <Label>Risk Description *</Label>
          <Textarea value={description} onChange={(e) => setDesc(e.target.value)} rows={4}
            placeholder="Describe the risk scenario, existing controls, and potential threat vectors…" required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Industry (optional)</Label>
            <Select value={industry} onChange={(e) => setIndustry(e.target.value)}>
              <option value="">Select industry…</option>
              {INDUSTRIES.map((i) => <option key={i}>{i}</option>)}
            </Select>
          </div>
          <div>
            <Label>Business Context (optional)</Label>
            <Input value={context} onChange={(e) => setContext(e.target.value)} placeholder="e.g. SaaS, 50k users, SOC 2 audit pending" />
          </div>
        </div>
        <RunButton loading={isPending}>Analyse Risk</RunButton>
      </form>

      {isPending && <LoadingOverlay message="Running risk assessment…" />}

      {data && (
        <div className="space-y-4">
          {/* Risk Matrix Summary */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-800 mb-4">Risk Assessment Matrix</h3>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-[11px] text-slate-500 mb-1">Likelihood</p>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${RISK_COLORS[data.likelihood]}`}>
                  {RISK_LABELS[data.likelihood]}
                </span>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-300" />
              <div className="text-center">
                <p className="text-[11px] text-slate-500 mb-1">Impact</p>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${RISK_COLORS[data.impact]}`}>
                  {RISK_LABELS[data.impact]}
                </span>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-300" />
              <div className="text-center">
                <p className="text-[11px] text-slate-500 mb-1">Risk Score</p>
                <span className={`text-2xl font-bold rounded-xl px-4 py-1 ${riskScoreColor(data.riskScore)}`}>
                  {data.riskScore}/25
                </span>
              </div>
            </div>
          </div>

          <ResultCard title="Risk Assessment Narrative">
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{data.summary}</p>
          </ResultCard>

          <div className="grid grid-cols-2 gap-4">
            <ResultCard title="Mitigation Strategies">
              <ul className="space-y-1.5">
                {data.mitigationStrategies.map((s, i) => <BulletItem key={i}>{s}</BulletItem>)}
              </ul>
            </ResultCard>
            <ResultCard title="Regulatory Considerations" accent="amber">
              <ul className="space-y-1.5">
                {data.regulatoryConsiderations.map((r, i) => <BulletItem key={i} dot="amber">{r}</BulletItem>)}
              </ul>
            </ResultCard>
          </div>

          <ResultCard title="Residual Risk">
            <p className="text-sm text-slate-700 leading-relaxed">{data.residualRisk}</p>
          </ResultCard>
        </div>
      )}
    </div>
  );
}

// ── 4. Checklist Generator ─────────────────────────────────────────────────────

const CHECKLIST_FRAMEWORKS = [
  'ISO 27001:2022', 'SOC 2 Type II', 'GDPR', 'HIPAA', 'PCI DSS v4.0',
  'NIST CSF 2.0', 'NIST SP 800-53 Rev 5', 'CIS Controls v8', 'FedRAMP',
  'ISO 9001:2015', 'ISO 22301', 'CCPA', 'DORA',
];

const PRIORITY_COLORS: Record<ChecklistItem['priority'], string> = {
  critical: 'bg-red-100 text-red-700',
  high:     'bg-orange-100 text-orange-700',
  medium:   'bg-amber-100 text-amber-700',
  low:      'bg-slate-100 text-slate-600',
};

function ChecklistGenerator() {
  const [framework, setFramework]   = useState(CHECKLIST_FRAMEWORKS[0]);
  const [scope, setScope]           = useState('');
  const [orgSize, setOrgSize]       = useState<'small' | 'medium' | 'large' | 'enterprise'>('medium');
  const [context, setContext]       = useState('');
  const [checked, setChecked]       = useState<Set<string>>(new Set());
  const { mutate, isPending, data } = useGenerateChecklist();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setChecked(new Set());
    mutate({ framework, scope: scope || undefined, organizationSize: orgSize, additionalContext: context || undefined });
  };

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const completionPct = data && data.totalItems > 0 ? Math.round((checked.size / data.totalItems) * 100) : 0;

  const grouped = data
    ? (data.items ?? []).reduce<Record<string, ChecklistItem[]>>((acc, item) => {
        (acc[item.category] ??= []).push(item);
        return acc;
      }, {})
    : {};

  return (
    <div className="space-y-5">
      <form onSubmit={onSubmit} className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label>Framework *</Label>
            <Select value={framework} onChange={(e) => setFramework(e.target.value)}>
              {CHECKLIST_FRAMEWORKS.map((f) => <option key={f}>{f}</option>)}
            </Select>
          </div>
          <div>
            <Label>Organisation Size</Label>
            <Select value={orgSize} onChange={(e) => setOrgSize(e.target.value as any)}>
              <option value="small">Small (1-50)</option>
              <option value="medium">Medium (51-500)</option>
              <option value="large">Large (501-5000)</option>
              <option value="enterprise">Enterprise (5000+)</option>
            </Select>
          </div>
          <div>
            <Label>Scope (optional)</Label>
            <Input value={scope} onChange={(e) => setScope(e.target.value)} placeholder="e.g. cloud infrastructure only" />
          </div>
          <div className="col-span-2">
            <Label>Additional Context (optional)</Label>
            <Textarea value={context} onChange={(e) => setContext(e.target.value)} rows={2} placeholder="Industry, existing controls, audit date…" />
          </div>
        </div>
        <RunButton loading={isPending}>Generate Checklist</RunButton>
      </form>

      {isPending && <LoadingOverlay message="Building your compliance checklist…" />}

      {data && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-800">{data.title}</h3>
              <p className="text-xs text-slate-500 mt-0.5">{data.totalItems} requirements across {Object.keys(grouped).length} categories</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500 mb-1">{checked.size}/{data.totalItems} complete</p>
              <div className="w-32 h-2 rounded-full bg-slate-200">
                <div className="h-2 rounded-full bg-green-500 transition-all" style={{ width: `${completionPct}%` }} />
              </div>
            </div>
          </div>

          {Object.entries(grouped).map(([category, items]) => (
            <div key={category} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
                <h4 className="text-xs font-semibold text-slate-700">{category}</h4>
              </div>
              <ul className="divide-y divide-slate-100">
                {items.map((item) => (
                  <li key={item.id} className="flex items-start gap-3 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={checked.has(item.id)}
                      onChange={() => toggle(item.id)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-green-600 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm text-slate-700 ${checked.has(item.id) ? 'line-through text-slate-400' : ''}`}>
                          {item.requirement}
                        </p>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${PRIORITY_COLORS[item.priority]}`}>
                          {item.priority}
                        </span>
                      </div>
                      {item.notes && (
                        <p className="mt-0.5 text-[11px] text-slate-400">{item.notes}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 5. Document Q&A ────────────────────────────────────────────────────────────

const CONFIDENCE_STYLES = {
  high:      'bg-green-50 text-green-700 border-green-200',
  medium:    'bg-amber-50 text-amber-700 border-amber-200',
  low:       'bg-orange-50 text-orange-700 border-orange-200',
  not_found: 'bg-red-50 text-red-700 border-red-200',
};

const CONFIDENCE_LABELS = {
  high: 'High confidence', medium: 'Medium confidence',
  low: 'Low confidence', not_found: 'Not found in document',
};

function DocumentQa() {
  const [evidenceId, setEvidenceId] = useState('');
  const [question, setQuestion]     = useState('');
  const { mutate, isPending, data } = useDocumentQa();

  const SAMPLE_QUESTIONS = [
    'What are the termination conditions?',
    'Who are the parties involved?',
    'What data retention periods are specified?',
    'What are the liability limitations?',
    'When does this agreement expire?',
  ];

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutate({ evidenceId: evidenceId.trim(), question: question.trim() });
  };

  return (
    <div className="space-y-5">
      <form onSubmit={onSubmit} className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div>
          <Label>Evidence ID (UUID of the document)</Label>
          <Input
            value={evidenceId}
            onChange={(e) => setEvidenceId(e.target.value)}
            placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
            required
          />
        </div>
        <div>
          <Label>Your Question *</Label>
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={3}
            placeholder="Ask anything about the document…"
            required
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SAMPLE_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setQuestion(q)}
                className="rounded-full border border-slate-200 px-2.5 py-0.5 text-[11px] text-slate-600 hover:border-blue-300 hover:text-blue-700 hover:bg-blue-50"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
        <RunButton loading={isPending}>Ask Question</RunButton>
      </form>

      {isPending && <LoadingOverlay message="Reading the document and formulating an answer…" />}

      {data && (
        <div className="space-y-4">
          <div className={`rounded-xl border p-4 ${CONFIDENCE_STYLES[data.confidence]}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide">{CONFIDENCE_LABELS[data.confidence]}</span>
              <CopyButton text={data.answer} />
            </div>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{data.answer}</p>
          </div>

          {(data.citations?.length ?? 0) > 0 && (
            <ResultCard title="Supporting Citations">
              <ul className="space-y-2">
                {(data.citations ?? []).map((c, i) => (
                  <li key={i} className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-600 italic">
                    "{c}"
                  </li>
                ))}
              </ul>
            </ResultCard>
          )}
        </div>
      )}
    </div>
  );
}

// ── 6. AI Search ─────────────────────────────────────────────────────────────

function AiSearchPanel() {
  const [query, setQuery]           = useState('');
  const { mutate, isPending, data } = useAiSearch();

  const SAMPLE_SEARCHES = [
    'data retention policy', 'access control requirements', 'incident response procedures',
    'third party vendor obligations', 'encryption standards',
  ];

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutate({ query: query.trim(), limit: 5 });
  };

  return (
    <div className="space-y-5">
      <form onSubmit={onSubmit} className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div>
          <Label>Search Query *</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search across all your compliance documents…"
              required
              className="w-full rounded-md border border-slate-300 pl-9 pr-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SAMPLE_SEARCHES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setQuery(s)}
                className="rounded-full border border-slate-200 px-2.5 py-0.5 text-[11px] text-slate-600 hover:border-blue-300 hover:text-blue-700 hover:bg-blue-50"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <RunButton loading={isPending}>Search</RunButton>
      </form>

      {isPending && <LoadingOverlay message="Searching your document library…" />}

      {data && (
        <div className="space-y-4">
          <ResultCard title="AI Answer">
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{data.answer}</p>
          </ResultCard>

          {(data.relevantDocuments?.length ?? 0) > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Relevant Documents</h3>
              <div className="space-y-2">
                {(data.relevantDocuments ?? []).map((doc, i) => (
                  <div key={i} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{doc.title}</p>
                        <p className="mt-1 text-xs text-slate-500 line-clamp-2">{doc.snippet}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="text-xs font-semibold text-blue-700">
                          {Math.round(doc.relevanceScore * 100)}% match
                        </span>
                        <p className="text-[10px] text-slate-400 mt-0.5 font-mono">{(doc.evidenceId ?? '').slice(0, 8)}…</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(data.suggestedQueries?.length ?? 0) > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Suggested Follow-up Searches</h3>
              <div className="flex flex-wrap gap-2">
                {(data.suggestedQueries ?? []).map((q, i) => (
                  <button
                    key={i}
                    onClick={() => { setQuery(q); }}
                    className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Shared result components ────────────────────────────────────────────────────

function ResultCard({ title, children, accent }: {
  title: string;
  children: React.ReactNode;
  accent?: 'red' | 'amber';
}) {
  const headerBg = accent === 'red' ? 'bg-red-50 border-red-100' : accent === 'amber' ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-200';
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className={`px-4 py-2.5 border-b ${headerBg}`}>
        <h4 className="text-xs font-semibold text-slate-700">{title}</h4>
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}

function BulletItem({ children, dot }: { children: React.ReactNode; dot?: 'red' | 'amber' }) {
  const dotColor = dot === 'red' ? 'bg-red-400' : dot === 'amber' ? 'bg-amber-400' : 'bg-slate-400';
  return (
    <li className="flex items-start gap-2 text-sm text-slate-600">
      <div className={`mt-2 h-1.5 w-1.5 rounded-full shrink-0 ${dotColor}`} />
      {children}
    </li>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const PANELS: Record<Tab, React.ComponentType> = {
  contract:  ContractSummarizer,
  policy:    PolicyGenerator,
  risk:      RiskAnalyzer,
  checklist: ChecklistGenerator,
  docqa:     DocumentQa,
  search:    AiSearchPanel,
};

export function AiToolsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('contract');
  const Panel = PANELS[activeTab];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="h-5 w-5 text-blue-500" />
          <h1 className="text-xl font-bold text-slate-900">AI Compliance Tools</h1>
        </div>
        <p className="text-sm text-slate-500">Powered by Groq AI — intelligent analysis for contracts, policies, risks, and compliance documents</p>
      </div>

      {/* Tab navigation */}
      <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1 mb-6">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
              activeTab === id
                ? 'bg-white shadow-sm text-slate-900'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Active panel */}
      <Panel />
    </div>
  );
}
