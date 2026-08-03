import React from 'react';
import { Activity, Upload, Eye, Download, Share2, FileSearch, Tag, Link, Archive, UserX, RefreshCw } from 'lucide-react';
import { useEvidenceAuditTrail } from '../hooks/use-evidence';
import { useOrgFormat } from '@/lib/org-format';

const EVENT_CONFIG: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  uploaded:        { icon: Upload,       label: 'Uploaded',             color: 'text-blue-600 bg-blue-100' },
  viewed:          { icon: Eye,          label: 'Viewed',               color: 'text-slate-600 bg-slate-100' },
  updated:         { icon: RefreshCw,    label: 'Updated',              color: 'text-indigo-600 bg-indigo-100' },
  downloaded:      { icon: Download,     label: 'Downloaded',           color: 'text-green-600 bg-green-100' },
  shared:          { icon: Share2,       label: 'Shared',               color: 'text-purple-600 bg-purple-100' },
  share_revoked:   { icon: UserX,        label: 'Share Revoked',        color: 'text-red-600 bg-red-100' },
  share_accessed:  { icon: Eye,          label: 'Share Accessed',       color: 'text-purple-600 bg-purple-100' },
  ocr_completed:   { icon: FileSearch,   label: 'OCR Completed',        color: 'text-teal-600 bg-teal-100' },
  ocr_retried:     { icon: FileSearch,   label: 'OCR Retried',          color: 'text-teal-600 bg-teal-100' },
  version_added:   { icon: Upload,       label: 'Version Uploaded',     color: 'text-blue-600 bg-blue-100' },
  tagged:          { icon: Tag,          label: 'Tag Added',            color: 'text-amber-600 bg-amber-100' },
  untagged:        { icon: Tag,          label: 'Tag Removed',          color: 'text-amber-600 bg-amber-100' },
  link_added:      { icon: Link,         label: 'Link Added',           color: 'text-cyan-600 bg-cyan-100' },
  link_removed:    { icon: Link,         label: 'Link Removed',         color: 'text-cyan-600 bg-cyan-100' },
  archived:        { icon: Archive,      label: 'Archived',             color: 'text-slate-600 bg-slate-100' },
  category_changed:{ icon: RefreshCw,    label: 'Category Changed',     color: 'text-indigo-600 bg-indigo-100' },
};

interface EvidenceAuditTrailProps {
  evidenceId: string;
}

export function EvidenceAuditTrail({ evidenceId }: EvidenceAuditTrailProps) {
  const fmt = useOrgFormat();
  const { data: events = [], isLoading } = useEvidenceAuditTrail(evidenceId);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-md bg-slate-100" />
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-slate-400">
        <Activity className="h-8 w-8" />
        <p className="text-sm">No activity yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
        <Activity className="h-4 w-4" />
        Audit Trail
      </h3>
      <ol className="relative border-l border-slate-200 pl-6 space-y-5">
        {events.map((event) => {
          const config = EVENT_CONFIG[event.eventType] ?? {
            icon: Activity, label: event.eventType.replace(/_/g, ' '), color: 'text-slate-600 bg-slate-100',
          };
          const Icon = config.icon;
          return (
            <li key={event.id} className="relative">
              <span className={`absolute -left-[1.625rem] flex h-6 w-6 items-center justify-center rounded-full ${config.color}`}>
                <Icon className="h-3 w-3" />
              </span>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">{config.label}</p>
                  {event.actorEmail && (
                    <p className="text-xs text-slate-500">by {event.actorEmail}</p>
                  )}
                  {!event.actorEmail && (
                    <p className="text-xs text-slate-400 italic">via public share link</p>
                  )}
                </div>
                <time className="shrink-0 text-xs text-slate-400">
                  {fmt.formatDateTimeMedium(event.createdAt)}
                </time>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
