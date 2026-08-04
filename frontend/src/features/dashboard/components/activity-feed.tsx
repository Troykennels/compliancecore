import React from 'react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import {
  Upload, Eye, Download, Edit3, Trash2, Share2,
  RotateCcw, FileSearch, Tag, Lock, CheckCircle, AlertCircle, History,
} from 'lucide-react';
import type { RecentActivityEvent } from '../api/dashboard.api';
import { cn } from '@/lib/utils';

const EVENT_ICON: Record<string, React.ReactNode> = {
  uploaded:         <Upload className="h-4 w-4" />,
  previewed:        <Eye className="h-4 w-4" />,
  downloaded:       <Download className="h-4 w-4" />,
  updated:          <Edit3 className="h-4 w-4" />,
  deleted:          <Trash2 className="h-4 w-4" />,
  shared:           <Share2 className="h-4 w-4" />,
  share_revoked:    <Lock className="h-4 w-4" />,
  ocr_completed:    <FileSearch className="h-4 w-4" />,
  ocr_failed:       <AlertCircle className="h-4 w-4" />,
  version_added:    <RotateCcw className="h-4 w-4" />,
  tag_added:        <Tag className="h-4 w-4" />,
  tag_removed:      <Tag className="h-4 w-4" />,
  confirmed:        <CheckCircle className="h-4 w-4" />,
};

/**
 * Tone by consequence, not by event.
 *
 * This map previously assigned nine different hues — blue, indigo, purple,
 * cyan, teal, amber, orange, green, red — one per event type, which made an
 * audit trail look like a chart legend and left the reader no way to tell an
 * ordinary preview from a deletion at a glance.
 *
 * Now the icon identifies *what* happened and the tone says *how much it
 * matters*: destructive actions are red, security-relevant ones amber,
 * successful outcomes green, and routine reads stay quiet.
 */
const EVENT_TONE: Record<string, string> = {
  deleted:       'bg-red-50 text-red-600 ring-red-600/15',
  ocr_failed:    'bg-red-50 text-red-600 ring-red-600/15',

  shared:        'bg-amber-50 text-amber-600 ring-amber-600/15',
  share_revoked: 'bg-amber-50 text-amber-600 ring-amber-600/15',
  downloaded:    'bg-amber-50 text-amber-600 ring-amber-600/15',

  confirmed:     'bg-green-50 text-green-600 ring-green-600/15',
  ocr_completed: 'bg-green-50 text-green-600 ring-green-600/15',

  uploaded:      'bg-brand-50 text-brand-600 ring-brand-600/15',
  updated:       'bg-brand-50 text-brand-600 ring-brand-600/15',
  version_added: 'bg-brand-50 text-brand-600 ring-brand-600/15',
};

const NEUTRAL_TONE = 'bg-slate-100 text-slate-500 ring-slate-500/15';

/**
 * The endpoint sends an event type and a metadata blob, not a written sentence.
 * The feed used to render `ev.description`, `ev.actorName` and
 * `ev.evidenceTitle` — three fields the API has never returned — so every row
 * showed a bare "System" with no text at all. The wording is built here
 * instead, from what actually arrives.
 */
const EVENT_VERB: Record<string, string> = {
  uploaded:      'uploaded',
  previewed:     'previewed',
  downloaded:    'downloaded',
  updated:       'updated',
  deleted:       'deleted',
  shared:        'shared',
  share_revoked: 'revoked sharing on',
  ocr_completed: 'finished text extraction on',
  ocr_failed:    'failed text extraction on',
  version_added: 'added a version to',
  tag_added:     'tagged',
  tag_removed:   'removed a tag from',
  confirmed:     'confirmed',
};

/** Best-effort title from the metadata blob, whatever key it happens to use. */
function subjectOf(metadata: Record<string, unknown> | null): string | null {
  if (!metadata) return null;
  for (const key of ['title', 'name', 'evidenceTitle', 'fileName', 'filename']) {
    const v = metadata[key];
    if (typeof v === 'string' && v.trim()) return v;
  }
  return null;
}

interface ActivityFeedProps {
  events: RecentActivityEvent[];
}

export function ActivityFeed({ events }: ActivityFeedProps) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <History className="mb-2 h-7 w-7 text-slate-300" aria-hidden="true" />
        <p className="text-xs font-medium text-slate-600">No activity yet</p>
        <p className="mt-0.5 max-w-[18rem] text-2xs text-slate-400">
          Every upload, download and share is recorded here — this is the trail
          you hand to an auditor.
        </p>
      </div>
    );
  }

  return (
    <ol className="relative">
      {events.map((ev, idx) => {
        const icon = EVENT_ICON[ev.eventType] ?? <CheckCircle className="h-4 w-4" />;
        const tone = EVENT_TONE[ev.eventType] ?? NEUTRAL_TONE;
        const subject = subjectOf(ev.metadata);
        const isLast = idx === events.length - 1;
        return (
          <li key={ev.id} className="relative flex items-start gap-3 pb-4 last:pb-0">
            {/* Timeline rail. Stops at the last node rather than trailing off
                into empty space below it. */}
            {!isLast && (
              <span
                className="absolute left-4 top-9 h-[calc(100%-1.5rem)] w-px bg-slate-200"
                aria-hidden="true"
              />
            )}
            <span
              className={cn(
                'relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-1 ring-inset',
                tone,
              )}
            >
              {icon}
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <p className="text-sm leading-snug text-slate-700">
                <span className="font-medium text-slate-900">{ev.actorEmail ?? 'System'}</span>
                {' '}{EVENT_VERB[ev.eventType] ?? ev.eventType.replace(/_/g, ' ')}
                {subject ? (
                  <span className="font-medium text-slate-900"> &ldquo;{subject}&rdquo;</span>
                ) : ' an evidence item'}
              </p>
              <time
                dateTime={ev.createdAt}
                className="mt-0.5 block text-2xs text-slate-400"
              >
                {formatDistanceToNow(parseISO(ev.createdAt), { addSuffix: true })}
              </time>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
