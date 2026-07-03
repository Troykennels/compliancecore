import React, { useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X } from 'lucide-react';
import { sha256 } from '@/lib/sha256';
import { useDecideApproval } from '../hooks/use-approvals';
import type { ApprovalDecision, ApprovalRequestStep } from '../types/approvals.types';

const schema = z.object({
  decision:   z.enum(['approved', 'rejected', 'changes_requested', 'abstained']),
  comments:   z.string().max(5000).optional(),
  useSignature: z.boolean().default(false),
});

type FormValues = z.infer<typeof schema>;

interface ApprovalDecisionModalProps {
  open:      boolean;
  onClose:   () => void;
  requestId: string;
  step:      ApprovalRequestStep;
}

export function ApprovalDecisionModal({ open, onClose, requestId, step }: ApprovalDecisionModalProps) {
  const decide = useDecideApproval(requestId);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);

  const { register, watch, handleSubmit, reset } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (open) reset({ decision: 'approved', comments: '', useSignature: false });
  }, [open, reset]);

  // Canvas drawing
  function startDraw(e: React.MouseEvent) {
    isDrawing.current = true;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  }
  function draw(e: React.MouseEvent) {
    if (!isDrawing.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  function endDraw() { isDrawing.current = false; }
  function clearCanvas() {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !canvasRef.current) return;
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  }

  const useSignature = watch('useSignature');

  const onSubmit = async (values: FormValues) => {
    let signatureImageBase64: string | undefined;
    let documentHash: string | undefined;

    if (values.useSignature && step.requireSignature) {
      signatureImageBase64 = canvasRef.current?.toDataURL('image/png');
      const content = `${requestId}:${step.id}:${values.decision}`;
      documentHash = await sha256(content);
    }

    await decide.mutateAsync({
      decision:             values.decision as ApprovalDecision,
      comments:             values.comments || undefined,
      signatureImageBase64,
      documentHash,
    });
    onClose();
  };

  if (!open) return null;

  const DECISION_CONFIG = {
    approved:          { label: 'Approve',          color: 'bg-green-600 hover:bg-green-700', textColor: 'text-green-700' },
    rejected:          { label: 'Reject',            color: 'bg-red-600 hover:bg-red-700',   textColor: 'text-red-700' },
    changes_requested: { label: 'Request Changes',  color: 'bg-orange-600 hover:bg-orange-700', textColor: 'text-orange-700' },
    abstained:         { label: 'Abstain',           color: 'bg-slate-600 hover:bg-slate-700', textColor: 'text-slate-700' },
  };

  const selected = watch('decision');
  const cfg = DECISION_CONFIG[selected as keyof typeof DECISION_CONFIG] ?? DECISION_CONFIG.approved;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 shrink-0">
          <h2 className="text-base font-semibold text-slate-900">Record Decision — {step.name}</h2>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            {/* Decision radio */}
            <div>
              <label className="mb-2 block text-xs font-medium text-slate-700">Decision *</label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(DECISION_CONFIG).map(([val, c]) => (
                  <label
                    key={val}
                    className={`flex items-center gap-2 rounded-lg border-2 px-3 py-2.5 cursor-pointer transition-colors ${
                      selected === val ? 'border-current ' + c.textColor : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <input type="radio" value={val} {...register('decision')} className="sr-only" />
                    <div className={`h-3.5 w-3.5 rounded-full border-2 flex items-center justify-center ${selected === val ? 'border-current' : 'border-slate-300'}`}>
                      {selected === val && <div className="h-1.5 w-1.5 rounded-full bg-current" />}
                    </div>
                    <span className="text-sm font-medium">{c.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Comments */}
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Comments {selected !== 'approved' ? '*' : '(optional)'}
              </label>
              <textarea
                {...register('comments')}
                rows={3}
                placeholder={
                  selected === 'rejected' ? 'Reason for rejection...' :
                  selected === 'changes_requested' ? 'What changes are needed...' :
                  'Optional notes...'
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm resize-none outline-none focus:border-blue-500"
              />
            </div>

            {/* Digital signature */}
            {step.requireSignature && (
              <div>
                <label className="flex items-center gap-2 cursor-pointer mb-2 text-sm text-slate-700">
                  <input type="checkbox" {...register('useSignature')} className="h-4 w-4 rounded border-slate-300" />
                  Add digital signature
                </label>
                {useSignature && (
                  <div>
                    <canvas
                      ref={canvasRef}
                      width={420}
                      height={120}
                      className="w-full rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 cursor-crosshair"
                      onMouseDown={startDraw}
                      onMouseMove={draw}
                      onMouseUp={endDraw}
                      onMouseLeave={endDraw}
                    />
                    <button type="button" onClick={clearCanvas} className="mt-1 text-xs text-slate-500 hover:text-slate-700">
                      Clear signature
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4 shrink-0">
            <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">Cancel</button>
            <button
              type="submit"
              disabled={decide.isPending}
              className={`rounded-md px-5 py-2 text-sm font-semibold text-white disabled:opacity-50 ${cfg.color}`}
            >
              {decide.isPending ? 'Saving...' : cfg.label}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
