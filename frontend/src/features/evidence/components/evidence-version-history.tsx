import { useState } from 'react';
import { Clock, Download, Upload } from 'lucide-react';
import { useEvidenceVersions } from '../hooks/use-evidence';
import { evidenceApi } from '../api/evidence.api';
import { useUpload } from '../hooks/use-upload';
import { EvidenceDropzone } from './evidence-dropzone';
import { useOrgFormat } from '@/lib/org-format';

interface EvidenceVersionHistoryProps {
  evidenceId: string;
  currentVersionId: string | null;
}

function formatBytes(bytes: number) {
  if (!bytes) return '—';
  const k = 1024;
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`;
}

export function EvidenceVersionHistory({ evidenceId, currentVersionId }: EvidenceVersionHistoryProps) {
  const fmt = useOrgFormat();
  const { data: versions = [], refetch } = useEvidenceVersions(evidenceId);
  const [showNewVersion, setShowNewVersion] = useState(false);
  const [newFile, setNewFile] = useState<File | null>(null);
  const [changeNote, setChangeNote] = useState('');
  const { state, uploadVersion, reset } = useUpload({
    onSuccess: () => {
      setShowNewVersion(false);
      setNewFile(null);
      setChangeNote('');
      reset();
      refetch();
    },
  });

  const handleUpload = () => {
    if (!newFile) return;
    uploadVersion(evidenceId, newFile, changeNote || undefined);
  };

  const handleDownload = async (versionId: string) => {
    try {
      const res = await evidenceApi.getVersionDownloadUrl(evidenceId, versionId);
      window.location.href = res.data.data!.downloadUrl;
    } catch {
      // silently fail — user will retry
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Clock className="h-4 w-4" /> Version History
        </h3>
        <button
          type="button"
          onClick={() => setShowNewVersion(!showNewVersion)}
          className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
        >
          <Upload className="h-3.5 w-3.5" />
          Upload New Version
        </button>
      </div>

      {/* New version upload panel */}
      {showNewVersion && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
          <EvidenceDropzone
            file={newFile}
            onFileSelect={setNewFile}
            onFileClear={() => setNewFile(null)}
            disabled={['creating', 'uploading', 'confirming'].includes(state.step)}
          />
          <input
            type="text"
            placeholder="Describe what changed in this version..."
            value={changeNote}
            onChange={(e) => setChangeNote(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
          {state.step === 'uploading' && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-slate-600">
                <span>Uploading...</span>
                <span>{state.progress}%</span>
              </div>
              <div className="h-1 rounded-full bg-slate-200">
                <div className="h-1 rounded-full bg-blue-600 transition-all" style={{ width: `${state.progress}%` }} />
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={() => { setShowNewVersion(false); setNewFile(null); reset(); }}
              className="rounded px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleUpload}
              disabled={!newFile || ['creating', 'uploading', 'confirming'].includes(state.step)}
              className="rounded bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {state.step !== 'idle' && state.step !== 'done' && state.step !== 'error' ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </div>
      )}

      {/* Version list */}
      <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
        {versions.map((version) => {
          const isCurrent = version.id === currentVersionId;
          const isCompleted = version.uploadStatus === 'completed';
          return (
            <div key={version.id} className="flex items-start gap-3 px-4 py-3">
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                {version.versionNumber}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-slate-800 truncate">{version.fileName}</span>
                  {isCurrent && (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                      Current
                    </span>
                  )}
                  {!isCompleted && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700 capitalize">
                      {version.uploadStatus}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-slate-500">
                  <span>{formatBytes(version.fileSizeBytes)}</span>
                  <span>·</span>
                  <span>{fmt.formatDateTimeMedium(version.createdAt)}</span>
                  {version.uploaderName && <><span>·</span><span>{version.uploaderName}</span></>}
                </div>
                {version.changeNote && (
                  <p className="mt-1 text-xs text-slate-600 italic">{version.changeNote}</p>
                )}
              </div>
              {isCompleted && (
                <button
                  type="button"
                  onClick={() => handleDownload(version.id)}
                  className="shrink-0 rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  title="Download this version"
                >
                  <Download className="h-4 w-4" />
                </button>
              )}
            </div>
          );
        })}
        {versions.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-slate-500">No versions yet.</p>
        )}
      </div>
    </div>
  );
}
