import { useState } from 'react';
import { ShieldCheck, ShieldX, ShieldAlert } from 'lucide-react';
import { useOrgFormat } from '@/lib/org-format';
import { useVerifySignature } from '../hooks/use-signatures';

interface SignatureBadgeProps {
  signatureId: string;
  compact?:    boolean;
}

export function SignatureBadge({ signatureId, compact = false }: SignatureBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const fmt = useOrgFormat();
  const { data: result, isLoading } = useVerifySignature(signatureId);

  if (isLoading) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-400">
        <ShieldAlert className="h-3 w-3" /> Verifying…
      </span>
    );
  }

  if (!result) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-400">
        <ShieldAlert className="h-3 w-3" /> Unknown
      </span>
    );
  }

  const isValid = result.isValid;
  const sig = result.signature;

  if (compact) {
    return (
      <div className="relative inline-block">
        <button
          type="button"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold cursor-default ${
            isValid ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {isValid ? <ShieldCheck className="h-3 w-3" /> : <ShieldX className="h-3 w-3" />}
          {isValid ? 'Signed' : 'Revoked'}
        </button>

        {showTooltip && (
          <div className="absolute bottom-full left-0 mb-2 z-50 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-xl text-xs">
            <div className="font-semibold text-slate-800 mb-2 flex items-center gap-1.5">
              {isValid ? <ShieldCheck className="h-3.5 w-3.5 text-green-500" /> : <ShieldX className="h-3.5 w-3.5 text-red-500" />}
              Digital Signature {isValid ? 'Valid' : 'Revoked'}
            </div>
            {sig.certificateData && (
              <dl className="space-y-1">
                <TooltipRow label="Signed by" value={sig.certificateData.signerName} />
                <TooltipRow label="Email" value={sig.certificateData.signerEmail} />
                <TooltipRow label="Signed at" value={fmt.formatDateTime(sig.signedAt)} />
                <TooltipRow label="Algorithm" value={sig.certificateData.algorithm} />
              </dl>
            )}
            {!isValid && sig.revocationReason && (
              <p className="mt-2 text-red-600">Reason: {sig.revocationReason}</p>
            )}
            <p className="mt-2 text-[10px] text-slate-400 font-mono break-all">
              {sig.signatureHash.slice(0, 24)}…
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`rounded-xl border p-4 ${isValid ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
      <div className="flex items-start gap-3">
        {isValid
          ? <ShieldCheck className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
          : <ShieldX className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
        }
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${isValid ? 'text-green-800' : 'text-red-800'}`}>
            {isValid ? 'Digitally Signed' : 'Signature Revoked'}
          </p>
          {sig.certificateData && (
            <div className="mt-1.5 space-y-0.5 text-xs text-slate-600">
              <p>By <span className="font-medium">{sig.certificateData.signerName}</span> ({sig.certificateData.signerEmail})</p>
              <p>{fmt.formatDateTime(sig.signedAt)}</p>
              <p className="font-mono text-[10px] text-slate-400 mt-1 break-all">{sig.signatureHash.slice(0, 32)}…</p>
            </div>
          )}
          {!isValid && sig.revocationReason && (
            <p className="mt-1 text-xs text-red-700">Revocation reason: {sig.revocationReason}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function TooltipRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-slate-400">{label}</dt>
      <dd className="text-slate-700 font-medium truncate max-w-[140px]">{value}</dd>
    </div>
  );
}
