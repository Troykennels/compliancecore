import { ModalSurface } from '@/components/modal-surface';
import { useState } from 'react';
import { AlertTriangle, Loader2, Trash2, X } from 'lucide-react';
import { useUnadoptFramework, useUnadoptImpact } from '../hooks/use-frameworks';
import type { UnadoptImpact } from '../types/frameworks.types';

/**
 * Removing an adopted framework.
 *
 * QA logged the absence of this as the product's one outright failure: a
 * framework adopted by mistake could not be undone anywhere, so the only route
 * back was to contact support.
 *
 * The dialog is deliberately two different dialogs wearing one shell, because
 * the two situations have almost nothing in common:
 *
 *   Nothing has been done to the controls — the mistake case, and the one QA
 *   actually hit. Somebody clicked Adopt on the wrong card thirty seconds ago.
 *   Say what will be removed, offer the button, get out of the way. Making this
 *   person type a confirmation phrase would be theatre.
 *
 *   Somebody has worked on them — statuses set, owners assigned, evidence
 *   attached. Now the click is expensive and possibly months of audit
 *   preparation, so the dialog names the damage item by item and asks for the
 *   framework's name to be typed. Not to be obstructive: to make sure the
 *   person understands which framework they are on. The grid is a wall of
 *   unfamiliar acronyms and the wrong card is easy to hit — which is how the
 *   framework got adopted by accident in the first place.
 *
 * Nothing here is destroyed outright. The server soft-deletes, so the controls
 * and everything pointing at them survive and an operator can restore them.
 */
export function RemoveFrameworkDialog({
  frameworkId,
  frameworkName,
  onClose,
}: {
  frameworkId: string;
  frameworkName: string;
  onClose: () => void;
}): JSX.Element {
  const { data: impact, isLoading, isError } = useUnadoptImpact(frameworkId);
  const { mutate: unadopt, isPending } = useUnadoptFramework();
  const [typed, setTyped] = useState('');
  const [serverWarning, setServerWarning] = useState<UnadoptImpact | null>(null);
  const [fallbackError, setFallbackError] = useState('');

  const risky = (impact?.touched ?? 0) > 0 || serverWarning !== null;
  const shown = serverWarning ?? impact;
  const name = shown?.frameworkName ?? frameworkName;
  // Case-insensitive and trimmed: the point is to prove you know which framework
  // this is, not to test your typing.
  const confirmed = !risky || typed.trim().toLowerCase() === name.trim().toLowerCase();

  function submit() {
    unadopt(
      { id: frameworkId, force: risky },
      {
        onSuccess: () => onClose(),
        onError: (err: unknown) => {
          /*
            A 409 is not a failure here.

            The server refuses an unforced removal when the controls carry work,
            and returns the itemised impact with it. That is the answer to the
            question this dialog is asking — so it becomes the warning, and the
            user gets to decide. Anything else really is an error.
          */
          const res = (err as {
            response?: { status?: number; data?: { error?: { message?: string; details?: UnadoptImpact } } };
          }).response;

          if (res?.status === 409 && res.data?.error?.details) {
            setServerWarning(res.data.error.details);
            setTyped('');
            return;
          }
          setServerWarning(null);
          // Surfaced inline rather than as a toast — the dialog is still open and
          // the message belongs next to the button that produced it.
          setFallbackError(res?.data?.error?.message ?? 'Could not remove this framework.');
        },
      },
    );
  }

  return (
    <ModalSurface label="Remove ?" onClose={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
          <div className="flex items-start gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                risky ? 'bg-rose-50' : 'bg-slate-100'
              }`}
            >
              {risky ? (
                <AlertTriangle className="h-5 w-5 text-rose-500" />
              ) : (
                <Trash2 className="h-5 w-5 text-slate-500" />
              )}
            </div>
            <div>
              <h2 id="removeFrameworkTitle" className="text-base font-semibold text-slate-900">
                Remove {name}?
              </h2>
              <p className="mt-0.5 text-sm text-slate-500">
                This withdraws its controls from your compliance scope.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          {isLoading && !serverWarning ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Checking what this would affect…
            </div>
          ) : isError && !serverWarning ? (
            <p className="text-sm text-slate-600">
              We could not check what this would affect. You can still remove the framework, and
              nothing is deleted permanently — but if you are unsure, close this and try again in
              a moment.
            </p>
          ) : (
            <>
              <p className="text-sm text-slate-600">
                <span className="font-semibold text-slate-900">{shown?.controls ?? 0}</span>{' '}
                control{(shown?.controls ?? 0) === 1 ? '' : 's'} will be removed from your scope.
                Your compliance score and dashboard will recalculate without{' '}
                {(shown?.controls ?? 0) === 1 ? 'it' : 'them'}.
              </p>

              {risky && shown ? (
                <>
                  <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-4">
                    <p className="text-sm font-semibold text-rose-900">
                      {shown.touched} of these {shown.touched === 1 ? 'has' : 'have'} work recorded
                      against {shown.touched === 1 ? 'it' : 'them'}
                    </p>
                    <ul className="mt-2 space-y-1 text-sm text-rose-800">
                      {shown.implemented > 0 && (
                        <li>· {shown.implemented} with an operating status recorded</li>
                      )}
                      {shown.withOwner > 0 && <li>· {shown.withOwner} with an assigned owner</li>}
                      {shown.withNotes > 0 && (
                        <li>· {shown.withNotes} with operating descriptions or check notes</li>
                      )}
                      {shown.withEvidence > 0 && (
                        <li>
                          · <span className="font-semibold">{shown.withEvidence} with evidence attached</span>
                        </li>
                      )}
                    </ul>
                    <p className="mt-3 text-xs text-rose-700">
                      Nothing is erased — the controls are archived and can be restored by an
                      administrator. But they will disappear from your controls list, your score
                      and your reports until they are.
                    </p>
                  </div>

                  <label className="mt-4 block text-sm font-medium text-slate-700">
                    Type <span className="font-semibold text-slate-900">{name}</span> to confirm
                    <input
                      autoFocus
                      value={typed}
                      onChange={(e) => setTyped(e.target.value)}
                      className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                      placeholder={name}
                    />
                  </label>
                </>
              ) : (
                <p className="mt-3 text-sm text-slate-500">
                  Nothing has been recorded against these controls yet, so nothing is lost. You can
                  assess {name} again at any time.
                </p>
              )}
            </>
          )}

          {fallbackError && (
            <p className="mt-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{fallbackError}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 border-t border-slate-200 p-5">
          <button
            onClick={onClose}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={isPending || !confirmed}
            className="inline-flex items-center gap-2 rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {risky ? 'Remove anyway' : 'Remove framework'}
          </button>
        </div>
      </div>
    </ModalSurface>
  );
}
