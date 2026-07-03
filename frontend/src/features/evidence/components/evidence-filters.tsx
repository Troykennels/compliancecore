import { Filter } from 'lucide-react';
import { useEvidenceCategories, useEvidenceTags } from '../hooks/use-evidence';
import type { EvidenceFilters, EvidenceStatus } from '../types/evidence.types';

interface EvidenceFiltersProps {
  filters: EvidenceFilters;
  onChange: (filters: EvidenceFilters) => void;
}

const STATUS_OPTIONS: { value: EvidenceStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
  { value: 'expired', label: 'Expired' },
];

const FILE_TYPE_OPTIONS = [
  { value: 'application/pdf', label: 'PDF' },
  { value: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', label: 'Word (DOCX)' },
  { value: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', label: 'Excel (XLSX)' },
  { value: 'image/', label: 'Images' },
  { value: 'text/', label: 'Text files' },
];

const OCR_OPTIONS = [
  { value: 'completed', label: 'OCR Complete' },
  { value: 'pending', label: 'OCR Pending' },
  { value: 'failed', label: 'OCR Failed' },
  { value: 'not_applicable', label: 'No OCR' },
];

export function EvidenceFiltersPanel({ filters, onChange }: EvidenceFiltersProps) {
  const { data: categories = [] } = useEvidenceCategories();
  const { data: tags = [] } = useEvidenceTags();

  const selectedTagIds = filters.tagIds ? filters.tagIds.split(',') : [];

  const toggleTag = (id: string) => {
    const next = selectedTagIds.includes(id)
      ? selectedTagIds.filter((t) => t !== id)
      : [...selectedTagIds, id];
    onChange({ ...filters, tagIds: next.length ? next.join(',') : undefined, page: 1 });
  };

  const set = (key: keyof EvidenceFilters, value: string | undefined) => {
    onChange({ ...filters, [key]: value || undefined, page: 1 });
  };

  const hasActiveFilters = Boolean(
    filters.categoryId || filters.tagIds || filters.status ||
    filters.mimeType || filters.ocrStatus || filters.dateFrom || filters.dateTo,
  );

  return (
    <aside className="w-56 shrink-0 space-y-5">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Filter className="h-4 w-4" /> Filters
        </span>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={() =>
              onChange({ page: 1, limit: filters.limit, sortBy: filters.sortBy, sortDir: filters.sortDir })
            }
            className="text-xs text-blue-600 hover:underline"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Status */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p>
        <div className="space-y-1">
          {STATUS_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="status"
                value={opt.value}
                checked={filters.status === opt.value}
                onChange={() => set('status', opt.value)}
                className="h-3.5 w-3.5 text-blue-600"
              />
              {opt.label}
            </label>
          ))}
          {filters.status && (
            <button onClick={() => set('status', undefined)} className="text-xs text-slate-400 hover:text-slate-600">
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Category */}
      {categories.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Category</p>
          <select
            value={filters.categoryId ?? ''}
            onChange={(e) => set('categoryId', e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="">All categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Tags</p>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => {
              const active = selectedTagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className="rounded-full px-2 py-0.5 text-xs font-medium transition-opacity"
                  style={{
                    backgroundColor: active ? tag.color : `${tag.color}33`,
                    color: active ? '#fff' : tag.color,
                    border: `1px solid ${tag.color}`,
                  }}
                >
                  {tag.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* File Type */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">File Type</p>
        <select
          value={filters.mimeType ?? ''}
          onChange={(e) => set('mimeType', e.target.value)}
          className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="">All types</option>
          {FILE_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* OCR Status */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">OCR Status</p>
        <select
          value={filters.ocrStatus ?? ''}
          onChange={(e) => set('ocrStatus', e.target.value as never)}
          className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="">Any</option>
          {OCR_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Date Range */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Date Range</p>
        <div className="space-y-2">
          <div>
            <label className="mb-0.5 block text-xs text-slate-500">From</label>
            <input
              type="date"
              value={filters.dateFrom ?? ''}
              onChange={(e) => set('dateFrom', e.target.value)}
              className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="mb-0.5 block text-xs text-slate-500">To</label>
            <input
              type="date"
              value={filters.dateTo ?? ''}
              onChange={(e) => set('dateTo', e.target.value)}
              className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>
    </aside>
  );
}
