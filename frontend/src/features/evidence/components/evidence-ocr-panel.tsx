import { FileSearch, Loader2, AlertTriangle, CheckCircle, RefreshCw, Ban } from 'lucide-react';
import { useEvidenceOcr, useRetryOcr } from '../hooks/use-evidence';

interface EvidenceOcrPanelProps {
  evidenceId: string;
}

export function EvidenceOcrPanel({ evidenceId }: EvidenceOcrPanelProps) {
  const { data, isLoading } = useEvidenceOcr(evidenceId);
  const retry = useRetryOcr(evidenceId);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-slate-500 text-sm py-4">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading OCR status...
      </div>
    );
  }

  const status = data?.ocrStatus ?? 'pending';
  const ocrText = data?.ocrText;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <FileSearch className="h-4 w-4" />
          OCR — Extracted Text
        </h3>
        {(status === 'failed' || status === 'completed') && (
          <button
            type="button"
            onClick={() => retry.mutate()}
            disabled={retry.isPending}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 disabled:opacity-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Re-run OCR
          </button>
        )}
      </div>

      {/* Status badge */}
      <div className="flex items-center gap-2">
        {status === 'pending' && (
          <span className="flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
            <Loader2 className="h-3 w-3 animate-spin" />
            Queued
          </span>
        )}
        {status === 'processing' && (
          <span className="flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
            <Loader2 className="h-3 w-3 animate-spin" />
            Processing...
          </span>
        )}
        {status === 'completed' && (
          <span className="flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
            <CheckCircle className="h-3 w-3" />
            Completed
          </span>
        )}
        {status === 'failed' && (
          <span className="flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700">
            <AlertTriangle className="h-3 w-3" />
            Failed
          </span>
        )}
        {status === 'not_applicable' && (
          <span className="flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
            <Ban className="h-3 w-3" />
            Not applicable for this file type
          </span>
        )}
      </div>

      {/* Extracted text */}
      {status === 'completed' && ocrText && (
        <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-4">
          <pre className="whitespace-pre-wrap text-xs text-slate-700 font-mono leading-relaxed">
            {ocrText}
          </pre>
        </div>
      )}

      {status === 'completed' && !ocrText && (
        <p className="text-sm text-slate-500 italic">
          OCR ran but no text was found in this document.
        </p>
      )}

      {status === 'failed' && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          OCR extraction failed. This may be due to an unreadable or encrypted file.
          Click "Re-run OCR" to try again.
        </div>
      )}

      {(status === 'pending' || status === 'processing') && (
        <p className="text-xs text-slate-500">
          This page will automatically update when extraction completes.
        </p>
      )}
    </div>
  );
}
