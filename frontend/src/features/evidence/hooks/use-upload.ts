import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { evidenceApi } from '../api/evidence.api';
import { evidenceKeys } from './use-evidence';
import type { InitiateUploadDto } from '../types/evidence.types';

type UploadStep = 'idle' | 'creating' | 'uploading' | 'confirming' | 'done' | 'error';

interface UploadState {
  step: UploadStep;
  progress: number;
  error: string | null;
  evidenceId: string | null;
  versionId: string | null;
}

interface UploadOptions {
  onSuccess?: (evidenceId: string) => void;
  onError?: (err: string) => void;
}

export function useUpload(options: UploadOptions = {}) {
  const qc = useQueryClient();
  const [state, setState] = useState<UploadState>({
    step: 'idle',
    progress: 0,
    error: null,
    evidenceId: null,
    versionId: null,
  });

  const reset = useCallback(() => {
    setState({ step: 'idle', progress: 0, error: null, evidenceId: null, versionId: null });
  }, []);

  const upload = useCallback(
    async (file: File, metadata: Omit<InitiateUploadDto, 'fileName' | 'fileSize' | 'mimeType'>) => {
      setState({ step: 'creating', progress: 0, error: null, evidenceId: null, versionId: null });

      try {
        // Step 1 — create evidence record + get presigned PUT URL
        const initiateRes = await evidenceApi.initiateUpload({
          ...metadata,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || 'application/octet-stream',
        });
        const { evidenceId, versionId, uploadUrl } = initiateRes.data.data!;
        setState((s) => ({ ...s, step: 'uploading', evidenceId, versionId }));

        // Step 2 — upload directly to S3 with progress tracking
        await uploadToS3WithProgress(file, uploadUrl, (pct) => {
          setState((s) => ({ ...s, progress: pct }));
        });

        setState((s) => ({ ...s, step: 'confirming', progress: 100 }));

        // Step 3 — confirm the upload with the backend
        await evidenceApi.confirmUpload(evidenceId, versionId, {
          fileSizeBytes: file.size,
        });

        setState((s) => ({ ...s, step: 'done' }));
        qc.invalidateQueries({ queryKey: evidenceKeys.lists() });
        options.onSuccess?.(evidenceId);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Upload failed.';
        setState((s) => ({ ...s, step: 'error', error: msg }));
        options.onError?.(msg);
        toast.error(msg);
      }
    },
    [qc, options],
  );

  // Upload a new version to an existing evidence record
  const uploadVersion = useCallback(
    async (
      evidenceId: string,
      file: File,
      changeNote?: string,
    ) => {
      setState({ step: 'creating', progress: 0, error: null, evidenceId, versionId: null });

      try {
        const initiateRes = await evidenceApi.initiateVersionUpload(evidenceId, {
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || 'application/octet-stream',
          changeNote,
        });
        const { versionId, uploadUrl } = initiateRes.data.data!;
        setState((s) => ({ ...s, step: 'uploading', versionId }));

        await uploadToS3WithProgress(file, uploadUrl, (pct) => {
          setState((s) => ({ ...s, progress: pct }));
        });

        setState((s) => ({ ...s, step: 'confirming', progress: 100 }));

        await evidenceApi.confirmUpload(evidenceId, versionId, { fileSizeBytes: file.size });

        setState((s) => ({ ...s, step: 'done' }));
        qc.invalidateQueries({ queryKey: evidenceKeys.detail(evidenceId) });
        qc.invalidateQueries({ queryKey: evidenceKeys.versions(evidenceId) });
        options.onSuccess?.(evidenceId);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Upload failed.';
        setState((s) => ({ ...s, step: 'error', error: msg }));
        options.onError?.(msg);
        toast.error(msg);
      }
    },
    [qc, options],
  );

  return { state, upload, uploadVersion, reset };
}

// XMLHttpRequest-based S3 PUT with progress events
function uploadToS3WithProgress(
  file: File,
  presignedUrl: string,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`S3 upload failed with status ${xhr.status}`));
    };

    xhr.onerror = () => reject(new Error('Network error during upload.'));
    xhr.onabort = () => reject(new Error('Upload aborted.'));

    xhr.open('PUT', presignedUrl);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.send(file);
  });
}
