import React from 'react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import {
  Upload, Eye, Download, Edit3, Trash2, Share2,
  RotateCcw, FileSearch, Tag, Lock, CheckCircle, AlertCircle,
} from 'lucide-react';
import type { RecentActivityEvent } from '../api/dashboard.api';

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

const EVENT_COLOR: Record<string, string> = {
  uploaded:      'bg-blue-100 text-blue-600',
  previewed:     'bg-slate-100 text-slate-500',
  downloaded:    'bg-indigo-100 text-indigo-600',
  updated:       'bg-amber-100 text-amber-600',
  deleted:       'bg-red-100 text-red-600',
  shared:        'bg-green-100 text-green-600',
  share_revoked: 'bg-orange-100 text-orange-600',
  ocr_completed: 'bg-purple-100 text-purple-600',
  ocr_failed:    'bg-red-100 text-red-600',
  version_added: 'bg-teal-100 text-teal-600',
  tag_added:     'bg-cyan-100 text-cyan-600',
  tag_removed:   'bg-slate-100 text-slate-500',
  confirmed:     'bg-green-100 text-green-600',
};

interface ActivityFeedProps {
  events: RecentActivityEvent[];
}

export function ActivityFeed({ events }: ActivityFeedProps) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-slate-400">
        <CheckCircle className="h-7 w-7 mb-2 opacity-30" />
        <p className="text-xs">No recent activity</p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {events.map((ev, idx) => {
        const icon  = EVENT_ICON[ev.eventType] ?? <CheckCircle className="h-4 w-4" />;
        const color = EVENT_COLOR[ev.eventType] ?? 'bg-slate-100 text-slate-500';
        return (
          <div key={ev.id} className="flex items-start gap-3 py-2.5 relative">
            {/* Connector line */}
            {idx < events.length - 1 && (
              <div className="absolute left-5 top-9 bottom-0 w-px bg-slate-100" />
            )}
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${color}`}>
              {icon}
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <p className="text-sm text-slate-700 leading-snug">
                <span className="font-medium text-slate-900">{ev.actorName ?? 'System'}</span>
                {' '}{ev.description}
                {ev.evidenceTitle && (
                  <span className="font-medium text-slate-900"> &quot;{ev.evidenceTitle}&quot;</span>
                )}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {formatDistanceToNow(parseISO(ev.createdAt), { addSuffix: true })}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
