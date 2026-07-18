import React, { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Plus, AlertTriangle, CheckCircle, Power, Trash2, ChevronRight, RefreshCw } from 'lucide-react';
import {
  useEscalationRules,
  useEscalationEvents,
  useToggleEscalationRule,
  useDeleteEscalationRule,
  useResolveEscalationEvent,
} from '../hooks/use-escalations';
import { EscalationRuleForm } from '../components/escalation-rule-form';
import { TRIGGER_CONFIG, ACTION_CONFIG } from '../types/escalations.types';
import type { EscalationEventStatus } from '../types/escalations.types';

type Tab = 'rules' | 'events';

const EVENT_STATUS_BADGE: Record<EscalationEventStatus, string> = {
  active:    'bg-red-50 text-red-700',
  resolved:  'bg-green-50 text-green-700',
  cancelled: 'bg-slate-100 text-slate-500',
  completed: 'bg-blue-50 text-blue-700',
};

const DEFAULT_STATUS_BADGE = 'bg-slate-100 text-slate-500';
const DEFAULT_TRIGGER_CFG = { label: 'Unknown Trigger', color: 'text-slate-600' };
const DEFAULT_ACTION_CFG = { label: 'Unknown Action', color: 'text-slate-600' };

function ErrorBlock({ label, onRetry }: { label: string; onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-rose-300 py-16 text-center">
      <AlertTriangle className="h-10 w-10 text-rose-400 mx-auto mb-2" />
      <p className="text-sm text-slate-500">{label}</p>
      <button
        onClick={onRetry}
        className="mt-3 inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
      >
        <RefreshCw className="h-4 w-4" /> Retry
      </button>
    </div>
  );
}

export function EscalationsPage() {
  const [tab, setTab] = useState<Tab>('rules');
  const [showForm, setShowForm] = useState(false);
  const [eventStatusFilter, setEventStatusFilter] = useState<EscalationEventStatus | ''>('');
  const [resolveTarget, setResolveTarget] = useState<string | null>(null);
  const [resolveNote, setResolveNote] = useState('');

  const { data: rulesData, isLoading: rulesLoading, isError: rulesError, refetch: refetchRules } = useEscalationRules();
  const { data: eventsData, isLoading: eventsLoading, isError: eventsError, refetch: refetchEvents } = useEscalationEvents(
    eventStatusFilter ? { status: eventStatusFilter } : {}
  );

  const toggleRule = useToggleEscalationRule();
  const deleteRule = useDeleteEscalationRule();
  const resolveEvent = useResolveEscalationEvent();

  const rules = rulesData?.items ?? [];
  const events = eventsData?.items ?? [];
  const activeEventCount = events.filter((e) => e.status === 'active').length;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Escalation Rules</h1>
          <p className="text-sm text-slate-500 mt-0.5">Automated escalation chains evaluated hourly by the BullMQ scheduler</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" /> New Rule
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-slate-100 p-1 w-fit mb-5">
        <TabButton active={tab === 'rules'} onClick={() => setTab('rules')}>
          Rules ({rules.length})
        </TabButton>
        <TabButton active={tab === 'events'} onClick={() => setTab('events')}>
          Active Events
          {activeEventCount > 0 && (
            <span className="ml-1.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">{activeEventCount}</span>
          )}
        </TabButton>
      </div>

      {/* Rules tab */}
      {tab === 'rules' && (
        <div>
          {rulesLoading ? (
            <div className="text-sm text-slate-400">Loading…</div>
          ) : rulesError ? (
            <ErrorBlock label="Couldn't load escalation rules." onRetry={() => refetchRules()} />
          ) : rules.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 py-16 text-center">
              <AlertTriangle className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No escalation rules defined</p>
              <button onClick={() => setShowForm(true)} className="mt-3 text-sm text-blue-600 hover:underline">Create your first rule</button>
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map((rule) => {
                const trigger = TRIGGER_CONFIG[rule.triggerType] ?? DEFAULT_TRIGGER_CFG;
                const conditions = rule.conditions ?? {};
                const chain = rule.escalationChain ?? [];
                return (
                  <div key={rule.id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-start gap-3">
                      <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${rule.isActive ? 'bg-green-500' : 'bg-slate-300'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{rule.name}</p>
                            {rule.description && <p className="text-xs text-slate-500 mt-0.5">{rule.description}</p>}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => toggleRule.mutate({ id: rule.id, isActive: !rule.isActive })}
                              disabled={toggleRule.isPending}
                              className={`rounded-lg p-1.5 ${rule.isActive ? 'text-green-600 hover:bg-green-50' : 'text-slate-400 hover:bg-slate-100'}`}
                              title={rule.isActive ? 'Deactivate' : 'Activate'}
                            >
                              <Power className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Delete "${rule.name}"? This cannot be undone.`)) {
                                  deleteRule.mutate(rule.id);
                                }
                              }}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                              title="Delete rule"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        {/* Trigger + chain summary */}
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                          <span className={`rounded-full bg-slate-100 px-2.5 py-0.5 font-medium ${trigger.color}`}>
                            {trigger.label}
                          </span>
                          {conditions.overdueHours && (
                            <span className="text-slate-500">after {conditions.overdueHours}h</span>
                          )}
                          {conditions.pendingHours && (
                            <span className="text-slate-500">after {conditions.pendingHours}h pending</span>
                          )}
                          {conditions.expiryDays && (
                            <span className="text-slate-500">{conditions.expiryDays}d before expiry</span>
                          )}
                          {conditions.priority && (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500 capitalize">{conditions.priority} priority</span>
                          )}
                        </div>

                        {/* Chain steps */}
                        <div className="mt-3 flex items-center gap-2 overflow-x-auto">
                          {chain.map((step, i) => {
                            const actionCfg = ACTION_CONFIG[step.action] ?? DEFAULT_ACTION_CFG;
                            return (
                              <React.Fragment key={i}>
                                <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-1.5 text-[11px] shrink-0">
                                  <p className={`font-semibold ${actionCfg.color}`}>{actionCfg.label}</p>
                                  <p className="text-slate-400">+{step.delayHours}h {step.targetRole ? `→ ${step.targetRole}` : ''}</p>
                                </div>
                                {i < chain.length - 1 && (
                                  <ChevronRight className="h-4 w-4 text-slate-300 shrink-0" />
                                )}
                              </React.Fragment>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Events tab */}
      {tab === 'events' && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <select
              value={eventStatusFilter}
              onChange={(e) => setEventStatusFilter(e.target.value as any)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs"
            >
              <option value="">All Events</option>
              <option value="active">Active</option>
              <option value="resolved">Resolved</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <span className="text-sm text-slate-400">{events.length} events</span>
          </div>

          {eventsLoading ? (
            <div className="text-sm text-slate-400">Loading…</div>
          ) : eventsError ? (
            <ErrorBlock label="Couldn't load escalation events." onRetry={() => refetchEvents()} />
          ) : events.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 py-16 text-center">
              <CheckCircle className="h-10 w-10 text-green-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No escalation events</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Rule</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Entity</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Chain Step</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Next Action</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Triggered</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {events.map((ev) => (
                    <tr key={ev.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-xs font-medium text-slate-800">{ev.ruleName ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        <span className="capitalize">{ev.entityType}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${EVENT_STATUS_BADGE[ev.status] ?? DEFAULT_STATUS_BADGE}`}>
                          {ev.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">Step {ev.currentChainStep + 1}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {ev.nextEscalationAt ? format(parseISO(ev.nextEscalationAt), 'MMM d, h:mm a') : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {format(parseISO(ev.createdAt), 'MMM d, yyyy')}
                      </td>
                      <td className="px-4 py-3">
                        {ev.status === 'active' && (
                          <button
                            onClick={() => setResolveTarget(ev.id)}
                            className="text-xs text-green-600 hover:underline font-medium"
                          >
                            Resolve
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Resolve modal */}
      {resolveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="rounded-xl bg-white p-6 shadow-2xl w-96">
            <h3 className="text-sm font-semibold text-slate-900 mb-1">Resolve Escalation</h3>
            <p className="text-xs text-slate-500 mb-3">Provide a resolution note to close this escalation event.</p>
            <textarea
              value={resolveNote}
              onChange={(e) => setResolveNote(e.target.value)}
              rows={3}
              placeholder="e.g. Issue addressed, task reassigned to team lead"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 resize-none mb-3"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setResolveTarget(null); setResolveNote(''); }} className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">Cancel</button>
              <button
                onClick={async () => {
                  await resolveEvent.mutateAsync({ id: resolveTarget, resolutionNote: resolveNote || undefined });
                  setResolveTarget(null);
                  setResolveNote('');
                }}
                disabled={resolveEvent.isPending}
                className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {resolveEvent.isPending ? 'Resolving…' : 'Resolve'}
              </button>
            </div>
          </div>
        </div>
      )}

      <EscalationRuleForm open={showForm} onClose={() => setShowForm(false)} />
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center rounded-md px-4 py-2 text-sm font-medium transition-colors ${
        active ? 'bg-white shadow-sm text-slate-900' : 'text-slate-600 hover:text-slate-900'
      }`}
    >
      {children}
    </button>
  );
}
