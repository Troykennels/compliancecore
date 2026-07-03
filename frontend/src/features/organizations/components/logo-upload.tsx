import { useRef, useState } from 'react';
import { Upload, X, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useUpdateOrganization } from '../hooks/use-organization';

interface Props {
  currentLogoUrl: string | null;
  orgName: string;
}

const MAX_SIZE_MB = 2;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];

export function LogoUpload({ currentLogoUrl, orgName }: Props): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(currentLogoUrl);
  const [isDragging, setIsDragging] = useState(false);
  const { mutate: updateOrg } = useUpdateOrganization();

  function handleFile(file: File) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Logo must be a JPG, PNG, WebP, or SVG file.');
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`Logo must be smaller than ${MAX_SIZE_MB}MB.`);
      return;
    }

    // Create local preview immediately
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    // In a full implementation, we would:
    // 1. Call POST /api/uploads/logo to get a presigned S3 URL
    // 2. PUT the file directly to S3
    // 3. Call PATCH /api/organizations/profile with the final logoUrl
    //
    // For now, we create an object URL and save it as the logoUrl.
    // Replace with presigned URL flow in the evidence/storage module.
    const objectUrl = URL.createObjectURL(file);
    updateOrg({ logoUrl: objectUrl });
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function removeLogo() {
    setPreview(null);
    updateOrg({ logoUrl: null });
  }

  return (
    <div className="flex items-start gap-6">
      {/* Logo Preview */}
      <div className="relative flex-shrink-0">
        <div className="h-20 w-20 rounded-xl border-2 border-slate-200 overflow-hidden bg-slate-50 flex items-center justify-center">
          {preview ? (
            <img src={preview} alt={`${orgName} logo`} className="h-full w-full object-contain" />
          ) : (
            <Building2 className="h-8 w-8 text-slate-300" />
          )}
        </div>
        {preview && (
          <button
            type="button"
            onClick={removeLogo}
            className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-white shadow-sm hover:bg-rose-600"
            aria-label="Remove logo"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          'flex-1 rounded-lg border-2 border-dashed p-4 text-center transition-colors cursor-pointer',
          isDragging ? 'border-indigo-400 bg-indigo-50' : 'border-slate-300 hover:border-slate-400',
        )}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        aria-label="Upload logo"
      >
        <Upload className="mx-auto mb-2 h-5 w-5 text-slate-400" />
        <p className="text-sm text-slate-600">
          <span className="font-medium text-indigo-600">Click to upload</span> or drag and drop
        </p>
        <p className="mt-1 text-xs text-slate-400">PNG, JPG, WebP, SVG up to {MAX_SIZE_MB}MB</p>
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_TYPES.join(',')}
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = ''; // reset so same file can be re-uploaded
          }}
        />
      </div>
    </div>
  );
}
