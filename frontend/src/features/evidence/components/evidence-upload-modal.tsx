import React, { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Lock, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUpload } from '../hooks/use-upload';
import { useEvidenceCategories } from '../hooks/use-evidence';
import { EvidenceDropzone } from './evidence-dropzone';
import { TagSelector } from './tag-selector';

const schema = z.object({
  title:         z.string().min(1, 'Title is required').max(500),
  description:   z.string().max(5000).optional(),
  categoryId:    z.string().uuid().optional().nullable(),
  tagIds:        z.array(z.string().uuid()).optional().default([]),
  isConfidential: z.boolean().optional().default(false),
  retentionDate: z.string().optional().nullable(),
  collectedAt:   z.string().optional().nullable(),
  changeNote:    z.string().max(500).optional(),
});

type FormValues = z.infer<typeof schema>;

interface EvidenceUploadModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (evidenceId: string) => void;
}

const UPLOAD_STEP_LABELS = {
  idle:       '',
  creating:   'Creating record...',
  uploading:  'Uploading file...',
  confirming: 'Confirming...',
  done:       'Upload complete',
  error:      'Upload failed',
};

export function EvidenceUploadModal({ open, onClose, onSuccess }: EvidenceUploadModalProps) {
  const { data: categories = [] } = useEvidenceCategories();
  const [file, setFile] = React.useState<File | null>(null);
  const { state, upload, reset } = useUpload({ onSuccess });

  const {
    register, control, handleSubmit, formState: { errors }, reset: resetForm,
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!open) {
      resetForm();
      setFile(null);
      reset();
    }
  }, [open, resetForm, reset]);

  const isInProgress = ['creating', 'uploading', 'confirming'].includes(state.step);

  const onSubmit = async (values: FormValues) => {
    if (!file) return;
    await upload(file, {
      title:         values.title,
      description:   values.description,
      categoryId:    values.categoryId,
      tagIds:        values.tagIds,
      isConfidential: values.isConfidential,
      retentionDate: values.retentionDate ?? undefined,
      collectedAt:   values.collectedAt ?? undefined,
      changeNote:    values.changeNote,
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Upload Evidence</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isInProgress}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 disabled:opacity-40"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {/* File drop */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">File</label>
              <EvidenceDropzone
                file={file}
                onFileSelect={setFile}
                onFileClear={() => setFile(null)}
                disabled={isInProgress}
              />
            </div>

            {/* Title */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                {...register('title')}
                placeholder="e.g. Q1 2026 SOC 2 Evidence"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
              {errors.title && <p className="mt-1 text-xs text-red-600">{errors.title.message}</p>}
            </div>

            {/* Description */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Description</label>
              <textarea
                {...register('description')}
                rows={2}
                placeholder="Brief description of this evidence item..."
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
              />
            </div>

            {/* Category + Tags row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Category</label>
                <select
                  {...register('categoryId')}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                >
                  <option value="">No category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Tags</label>
                <Controller
                  name="tagIds"
                  control={control}
                  render={({ field }) => (
                    <TagSelector
                      selected={field.value ?? []}
                      onChange={field.onChange}
                      disabled={isInProgress}
                    />
                  )}
                />
              </div>
            </div>

            {/* Dates row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> Collection Date
                </label>
                <input
                  type="date"
                  {...register('collectedAt')}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> Retention Date
                </label>
                <input
                  type="date"
                  {...register('retentionDate')}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Change note */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Change Note (optional)</label>
              <input
                {...register('changeNote')}
                placeholder="Describe what this evidence covers..."
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>

            {/* Confidential toggle */}
            <div className="flex items-start gap-3 rounded-lg bg-amber-50 border border-amber-200 p-3">
              <Controller
                name="isConfidential"
                control={control}
                render={({ field }) => (
                  <input
                    type="checkbox"
                    id="isConfidential"
                    checked={field.value}
                    onChange={field.onChange}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-amber-600"
                  />
                )}
              />
              <label htmlFor="isConfidential" className="text-sm cursor-pointer">
                <span className="flex items-center gap-1.5 font-medium text-amber-800">
                  <Lock className="h-3.5 w-3.5" />
                  Mark as Confidential
                </span>
                <span className="text-amber-700 text-xs mt-0.5 block">
                  Confidential evidence is only visible to compliance managers, admins, and owners.
                </span>
              </label>
            </div>
          </div>

          {/* Progress bar */}
          {isInProgress && (
            <div className="px-6 pb-2">
              <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
                <span>{UPLOAD_STEP_LABELS[state.step]}</span>
                {state.step === 'uploading' && <span>{state.progress}%</span>}
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-200">
                <div
                  className={cn(
                    'h-1.5 rounded-full transition-all duration-300',
                    state.step === 'confirming' ? 'bg-green-500' : 'bg-blue-600',
                  )}
                  style={{ width: `${state.step === 'creating' ? 10 : state.step === 'confirming' ? 100 : state.progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isInProgress}
              className="rounded-md px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!file || isInProgress}
              className="rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isInProgress ? 'Uploading...' : 'Upload Evidence'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
