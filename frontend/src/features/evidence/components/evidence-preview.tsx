import React from 'react';
import { Download, FileX, FileText, ExternalLink, Loader2 } from 'lucide-react';
import { useEvidencePreviewUrl } from '../hooks/use-evidence';

interface EvidencePreviewProps {
  evidenceId: string;
  fileName: string;
  mimeType: string;
}

export function EvidencePreview({ evidenceId, fileName }: EvidencePreviewProps) {
  const [externalPreview,setExternalPreview]=React.useState(false);
  const { data, isLoading, isError } = useEvidencePreviewUrl(evidenceId);
  React.useEffect(()=>setExternalPreview(false),[evidenceId,data?.officePreviewUrl]);

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3 rounded-lg border border-slate-200 bg-slate-50 text-slate-500">
        <FileX className="h-10 w-10" />
        <p className="text-sm">Unable to load preview.</p>
        <a
          href={data?.downloadUrl}
          download={fileName}
          className="flex items-center gap-2 rounded-md bg-slate-700 px-4 py-2 text-sm text-white hover:bg-slate-800"
        >
          <Download className="h-4 w-4" /> Download file
        </a>
      </div>
    );
  }

  const { previewType, url, officePreviewUrl, downloadUrl } = data;

  return (
    <div className="space-y-3">
      {/* Preview area */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
        {previewType === 'pdf' && url && <div className="flex flex-col items-center gap-3 p-6 text-center sm:hidden"><FileText className="h-10 w-10 text-brand-600" /><p className="break-all text-sm font-semibold text-slate-800">{fileName}</p><p className="text-sm text-slate-500">Open the PDF in your device’s viewer to read the full document.</p><a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white">Open PDF<ExternalLink className="h-4 w-4" /></a></div>}
        {previewType === 'pdf' && url && (
          <iframe
            src={url}
            title={fileName}
            className="hidden h-[700px] w-full sm:block"
          />
        )}

        {previewType === 'image' && url && (
          <div className="flex items-center justify-center bg-slate-900 p-4">
            <img
              src={url}
              alt={fileName}
              className="max-h-[700px] max-w-full object-contain"
            />
          </div>
        )}

        {previewType === 'text' && url && (
          <TextPreview url={url} />
        )}

        {previewType === 'office' && officePreviewUrl && !externalPreview&&<div className="space-y-3 p-5 text-sm"><p>Opening this preview sends a temporary document link to Microsoft’s online viewer. You can download the file and open it on your device.</p><button className="rounded bg-indigo-700 px-3 py-2 text-white" onClick={()=>setExternalPreview(true)}>Open with Microsoft’s viewer</button></div>}
        {previewType === 'office' && officePreviewUrl && externalPreview&&(
          <iframe
            src={officePreviewUrl}
            title={fileName}
            className="h-[700px] w-full"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        )}

        {previewType === 'none' && (
          <div className="flex h-64 flex-col items-center justify-center gap-3 text-slate-500">
            <p className="text-sm">Preview not available for this file type.</p>
          </div>
        )}
      </div>

      {/* Download bar */}
      <div className="flex flex-col items-start justify-between gap-3 rounded-lg bg-slate-100 px-4 py-3 sm:flex-row sm:items-center">
        <span className="break-all text-sm text-slate-700 sm:max-w-xs">{fileName}</span>
        <div className="flex items-center gap-2 shrink-0">
          {(previewType === 'pdf' || previewType === 'image') && url && (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-200"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open
            </a>
          )}
          <a
            href={downloadUrl}
            download={fileName}
            className="flex items-center gap-1.5 rounded-md bg-slate-700 px-3 py-1.5 text-sm text-white hover:bg-slate-800"
          >
            <Download className="h-3.5 w-3.5" />
            Download
          </a>
        </div>
      </div>
    </div>
  );
}

function TextPreview({ url }: { url: string }) {
  const [text, setText] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch(url)
      .then((r) => r.text())
      .then(setText)
      .catch(() => setText('Failed to load text content.'))
      .finally(() => setLoading(false));
  }, [url]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <pre className="max-h-[700px] overflow-auto whitespace-pre-wrap p-4 text-sm text-slate-800 font-mono">
      {text}
    </pre>
  );
}
