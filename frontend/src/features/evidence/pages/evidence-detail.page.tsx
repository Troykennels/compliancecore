import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Pencil, Trash2, Share2, Lock, ChevronDown,
  File, Calendar, Loader2, AlertCircle, X, Check,
} from 'lucide-react';
import { PATHS } from '@/routes/paths';
import { useEvidenceDetail, useUpdateEvidence, useDeleteEvidence, useEvidenceTagMutation } from '../hooks/use-evidence';
import { EvidencePreview } from '../components/evidence-preview';
import { EvidenceVersionHistory } from '../components/evidence-version-history';
import { EvidenceOcrPanel } from '../components/evidence-ocr-panel';
import { EvidenceAuditTrail } from '../components/evidence-audit-trail';
import { EvidenceShareModal } from '../components/evidence-share-modal';
import { TagSelector } from '../components/tag-selector';
import type { EvidenceStatus } from '../types/evidence.types';
import { useOrgFormat } from '@/lib/org-format';

const STATUS_OPTIONS: { value: EvidenceStatus; label: string; color: string }[] = [
  { value: 'active',   label: 'Active',   color: 'bg-green-100 text-green-700' },
  { value: 'archived', label: 'Archived', color: 'bg-slate-100 text-slate-600' },
  { value: 'expired',  label: 'Expired',  color: 'bg-red-100 text-red-700' },
];

type DetailTab = 'preview' | 'ocr' | 'versions' | 'audit';

export function EvidenceDetailPage() {
  const fmt = useOrgFormat();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: evidence, isLoading, isError } = useEvidenceDetail(id!);
  const updateEvidence = useUpdateEvidence(id!);
  const deleteEvidence = useDeleteEvidence();
  const tagMutation = useEvidenceTagMutation(id!);

  const [activeTab, setActiveTab] = useState<DetailTab>('preview');
  const [shareOpen, setShareOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-slate-400" />
      </div>
    );
  }

  if (isError || !evidence) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-500">
        <AlertCircle className="h-10 w-10" />
        <p>Evidence not found.</p>
        <button
          type="button"
          onClick={() => navigate(PATHS.EVIDENCE)}
          className="text-sm text-blue-600 hover:underline"
        >
          Back to Evidence Hub
        </button>
      </div>
    );
  }

  const statusConf = STATUS_OPTIONS.find((s) => s.value === evidence.status) ?? STATUS_OPTIONS[0];

  const handleDelete = async () => {
    await deleteEvidence.mutateAsync(id!);
    navigate(PATHS.EVIDENCE);
  };

  const handleTitleSave = async () => {
    if (!titleInput.trim() || titleInput === evidence.title) {
      setEditingTitle(false);
      return;
    }
    await updateEvidence.mutateAsync({ title: titleInput });
    setEditingTitle(false);
  };

  const startEditTitle = () => {
    setTitleInput(evidence.title);
    setEditingTitle(true);
  };

  const TABS: { key: DetailTab; label: string }[] = [
    { key: 'preview',  label: 'Preview' },
    { key: 'ocr',      label: 'OCR Text' },
    { key: 'versions', label: 'Versions' },
    { key: 'audit',    label: 'Audit Trail' },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-6 py-4 shrink-0">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <button
            type="button"
            onClick={() => navigate(PATHS.EVIDENCE)}
            className="mt-0.5 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            {editingTitle ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleTitleSave(); if (e.key === 'Escape') setEditingTitle(false); }}
                  className="rounded border border-blue-500 px-2 py-1 text-lg font-semibold text-slate-900 outline-none"
                />
                <button type="button" onClick={handleTitleSave} className="text-green-600 hover:text-green-700"><Check className="h-5 w-5" /></button>
                <button type="button" onClick={() => setEditingTitle(false)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 truncate">{evidence.title}</h1>
                <button type="button" onClick={startEditTitle} className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
            )}
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {/* Status dropdown */}
              <div className="relative group">
                <button className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusConf.color}`}>
                  {statusConf.label} <ChevronDown className="h-3 w-3" />
                </button>
                <div className="absolute top-full left-0 z-20 mt-1 hidden group-hover:block rounded-md border border-slate-200 bg-white shadow-lg p-1 min-w-[120px]">
                  {STATUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => updateEvidence.mutate({ status: opt.value })}
                      className={`flex w-full items-center rounded px-3 py-1.5 text-xs font-medium ${opt.value === evidence.status ? opt.color : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              {evidence.isConfidential && (
                <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                  <Lock className="h-3 w-3" /> Confidential
                </span>
              )}
              {evidence.categoryName && (
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
                  style={{ backgroundColor: evidence.categoryColor ?? '#64748B' }}
                >
                  {evidence.categoryName}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className="flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            <Share2 className="h-4 w-4" />
            Share
          </button>
          <button
            type="button"
            onClick={() => setDeleteConfirm(true)}
            className="rounded-md border border-red-200 p-2 text-red-500 hover:bg-red-50"
            title="Delete evidence"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left — Preview/tabs */}
        <div className="flex w-2/3 flex-col overflow-hidden border-r border-slate-200">
          {/* Tab bar */}
          <div className="flex border-b border-slate-200 bg-white px-4 shrink-0">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-600 hover:text-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'preview' && evidence.currentMimeType && evidence.currentFileName && (
              <EvidencePreview
                evidenceId={id!}
                fileName={evidence.currentFileName}
                mimeType={evidence.currentMimeType}
              />
            )}
            {activeTab === 'preview' && !evidence.currentMimeType && (
              <div className="flex h-64 flex-col items-center justify-center gap-3 text-slate-400">
                <File className="h-10 w-10" />
                <p className="text-sm">No file uploaded yet.</p>
              </div>
            )}
            {activeTab === 'ocr' && <EvidenceOcrPanel evidenceId={id!} />}
            {activeTab === 'versions' && (
              <EvidenceVersionHistory evidenceId={id!} currentVersionId={evidence.currentVersionId} />
            )}
            {activeTab === 'audit' && <EvidenceAuditTrail evidenceId={id!} />}
          </div>
        </div>

        {/* Right — Metadata panel */}
        <aside className="w-1/3 overflow-y-auto bg-white p-6 space-y-6">
          {/* Description */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Description
            </label>
            <p className="text-sm text-slate-700 leading-relaxed">
              {evidence.description || <span className="text-slate-400 italic">No description</span>}
            </p>
          </div>

          {/* Tags */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Tags
            </label>
            <TagSelector
              selected={evidence.tags.map((t) => t.id)}
              onChange={async (newIds) => {
                const existing = evidence.tags.map((t) => t.id);
                for (const id of newIds) {
                  if (!existing.includes(id)) await tagMutation.add.mutateAsync(id);
                }
                for (const id of existing) {
                  if (!newIds.includes(id)) await tagMutation.remove.mutateAsync(id);
                }
              }}
            />
          </div>

          {/* File metadata */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              File
            </label>
            <div className="space-y-1.5 text-sm">
              <MetaRow icon={File} label="Name" value={evidence.currentFileName ?? '—'} />
              <MetaRow
                icon={File}
                label="Version"
                value={evidence.currentVersionNumber ? `v${evidence.currentVersionNumber}` : '—'}
              />
            </div>
          </div>

          {/* Dates */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Dates
            </label>
            <div className="space-y-1.5 text-sm">
              <MetaRow
                icon={Calendar}
                label="Uploaded"
                value={fmt.formatDateMedium(evidence.createdAt)}
              />
              {evidence.collectedAt && (
                <MetaRow
                  icon={Calendar}
                  label="Collected"
                  value={fmt.formatDateMedium(evidence.collectedAt)}
                />
              )}
              {evidence.retentionDate && (
                <MetaRow
                  icon={Calendar}
                  label="Retention"
                  value={fmt.formatDateMedium(evidence.retentionDate)}
                />
              )}
            </div>
          </div>

          {/* Uploaded by */}
          {evidence.createdByName && (
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Uploaded By
              </label>
              <div className="flex items-center gap-2 text-sm">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                  {evidence.createdByName[0]?.toUpperCase()}
                </div>
                <span className="text-slate-700">{evidence.createdByName}</span>
              </div>
            </div>
          )}

          {/* Confidentiality toggle */}
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Confidentiality
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={evidence.isConfidential}
                onChange={(e) => updateEvidence.mutate({ isConfidential: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-amber-600"
              />
              <span className="text-sm text-slate-700">Mark as Confidential</span>
            </label>
          </div>
        </aside>
      </div>

      {/* Share Modal */}
      <EvidenceShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        evidenceId={id!}
        evidenceTitle={evidence.title}
      />

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-slate-900">Delete Evidence?</h3>
            <p className="mt-2 text-sm text-slate-600">
              This will permanently remove <strong>"{evidence.title}"</strong> and all its versions.
              This action cannot be undone.
            </p>
            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirm(false)}
                className="rounded-md px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteEvidence.isPending}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleteEvidence.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetaRow({
  icon: Icon, label, value,
}: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
      <span className="text-slate-500 min-w-[70px]">{label}</span>
      <span className="text-slate-800 break-all">{value}</span>
    </div>
  );
}
