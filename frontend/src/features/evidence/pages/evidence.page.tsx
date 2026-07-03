import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Upload, FileText, Lock, ChevronLeft, ChevronRight,
  File, Image, FileArchive, AlertCircle, Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import { PATHS } from '@/routes/paths';
import { useEvidence } from '../hooks/use-evidence';
import { EvidenceFiltersPanel } from '../components/evidence-filters';
import { EvidenceUploadModal } from '../components/evidence-upload-modal';
import type { Evidence, EvidenceFilters } from '../types/evidence.types';

function fileIcon(mimeType: string | null) {
  if (!mimeType) return File;
  if (mimeType.startsWith('image/')) return Image;
  if (mimeType === 'application/pdf') return FileText;
  if (mimeType.includes('zip') || mimeType.includes('tar')) return FileArchive;
  return FileText;
}

function formatBytes(bytes: number | null) {
  if (!bytes) return '—';
  const k = 1024;
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`;
}

const OCR_STATUS_BADGE: Record<string, string> = {
  pending:       'bg-amber-100 text-amber-700',
  processing:    'bg-blue-100 text-blue-700',
  completed:     'bg-green-100 text-green-700',
  failed:        'bg-red-100 text-red-700',
  not_applicable: 'bg-slate-100 text-slate-500',
};

function EvidenceCard({ evidence }: { evidence: Evidence }) {
  const navigate = useNavigate();
  const Icon = fileIcon(evidence.currentMimeType);

  return (
    <div
      onClick={() => navigate(PATHS.EVIDENCE_DETAIL(evidence.id))}
      className="group flex cursor-pointer gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-blue-300 hover:shadow-md transition-all"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
        <Icon className="h-6 w-6" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2 flex-wrap">
          <h3 className="text-sm font-semibold text-slate-800 group-hover:text-blue-700 truncate flex-1">
            {evidence.title}
          </h3>
          {evidence.isConfidential && (
            <span className="shrink-0 flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
              <Lock className="h-3 w-3" />
              Confidential
            </span>
          )}
          {evidence.status !== 'active' && (
            <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 capitalize">
              {evidence.status}
            </span>
          )}
        </div>

        {/* Tags */}
        {evidence.tags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {evidence.tags.slice(0, 4).map((tag) => (
              <span
                key={tag.id}
                className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
                style={{ backgroundColor: tag.color }}
              >
                {tag.name}
              </span>
            ))}
            {evidence.tags.length > 4 && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                +{evidence.tags.length - 4}
              </span>
            )}
          </div>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          {evidence.categoryName && (
            <span
              className="rounded-full px-2 py-0.5 font-medium text-white"
              style={{ backgroundColor: evidence.categoryColor ?? '#64748B' }}
            >
              {evidence.categoryName}
            </span>
          )}
          <span>{formatBytes(evidence.currentFileSizeBytes)}</span>
          {evidence.currentFileName && <span className="truncate max-w-[120px]">{evidence.currentFileName}</span>}
          {evidence.ocrStatus && evidence.ocrStatus !== 'not_applicable' && (
            <span className={`rounded-full px-2 py-0.5 capitalize font-medium ${OCR_STATUS_BADGE[evidence.ocrStatus]}`}>
              OCR {evidence.ocrStatus}
            </span>
          )}
          <span>·</span>
          <span>{format(new Date(evidence.createdAt), 'dd MMM yyyy')}</span>
        </div>
      </div>
    </div>
  );
}

export function EvidencePage() {
  const [filters, setFilters] = useState<EvidenceFilters>({
    page: 1, limit: 20, sortBy: 'created_at', sortDir: 'desc',
  });
  const [searchInput, setSearchInput] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);

  const { data, isLoading } = useEvidence(filters);
  const evidence = data?.evidence ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / (filters.limit ?? 20));

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setFilters((f) => ({ ...f, q: searchInput || undefined, page: 1 }));
  };

  const navigate = useNavigate();

  return (
    <div className="flex h-full flex-col">
      {/* Page header */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Evidence Hub</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {total.toLocaleString()} evidence item{total !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setUploadOpen(true)}
          className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Upload className="h-4 w-4" />
          Upload Evidence
        </button>
      </div>

      {/* Search bar */}
      <div className="border-b border-slate-200 bg-white px-6 py-3">
        <form onSubmit={handleSearch} className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="search"
              placeholder="Search evidence by title, content, or OCR text..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            className="rounded-md bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Search
          </button>
          {filters.q && (
            <button
              type="button"
              onClick={() => { setSearchInput(''); setFilters((f) => ({ ...f, q: undefined, page: 1 })); }}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              Clear
            </button>
          )}
        </form>
      </div>

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Filters sidebar */}
        <div className="w-60 shrink-0 overflow-y-auto border-r border-slate-200 bg-white p-5">
          <EvidenceFiltersPanel filters={filters} onChange={setFilters} />
        </div>

        {/* Evidence list */}
        <main className="flex-1 overflow-y-auto bg-slate-50 p-6">
          {/* Sort controls */}
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-slate-600">
              {filters.q && <span>Results for "<strong>{filters.q}</strong>" · </span>}
              {total} item{total !== 1 ? 's' : ''}
            </p>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500">Sort by</label>
              <select
                value={`${filters.sortBy}:${filters.sortDir}`}
                onChange={(e) => {
                  const [sortBy, sortDir] = e.target.value.split(':') as [typeof filters.sortBy, typeof filters.sortDir];
                  setFilters((f) => ({ ...f, sortBy, sortDir, page: 1 }));
                }}
                className="rounded border border-slate-300 px-2 py-1 text-xs"
              >
                <option value="created_at:desc">Newest first</option>
                <option value="created_at:asc">Oldest first</option>
                <option value="updated_at:desc">Recently updated</option>
                <option value="title:asc">Title A–Z</option>
                <option value="file_size:desc">Largest first</option>
              </select>
            </div>
          </div>

          {isLoading && (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          )}

          {!isLoading && evidence.length === 0 && (
            <div className="flex h-64 flex-col items-center justify-center gap-3 text-slate-400">
              <AlertCircle className="h-10 w-10" />
              <p className="text-sm">No evidence found.</p>
              <button
                type="button"
                onClick={() => setUploadOpen(true)}
                className="text-sm text-blue-600 hover:underline"
              >
                Upload your first evidence item
              </button>
            </div>
          )}

          <div className="space-y-3">
            {evidence.map((ev) => <EvidenceCard key={ev.id} evidence={ev} />)}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <button
                type="button"
                disabled={(filters.page ?? 1) <= 1}
                onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))}
                className="rounded-md border border-slate-300 p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm text-slate-600">
                Page {filters.page ?? 1} of {totalPages}
              </span>
              <button
                type="button"
                disabled={(filters.page ?? 1) >= totalPages}
                onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}
                className="rounded-md border border-slate-300 p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </main>
      </div>

      <EvidenceUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onSuccess={(id) => {
          setUploadOpen(false);
          navigate(PATHS.EVIDENCE_DETAIL(id));
        }}
      />
    </div>
  );
}
