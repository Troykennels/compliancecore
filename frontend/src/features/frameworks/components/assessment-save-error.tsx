import type { FormEvent } from 'react';

function messages(error: unknown): Array<{ path: string; message: string }> {
  const details = (error as { response?: { data?: { error?: { details?: unknown } } } })?.response?.data?.error?.details;
  if (Array.isArray(details)) return details.filter(item => typeof item?.message === 'string');
  if (details && typeof details === 'object') return Object.entries(details).filter(([, message]) => typeof message === 'string').map(([path, message]) => ({ path, message: String(message) }));
  return [];
}

export function AssessmentSaveError({ error, retry = false }: { error: unknown; retry?: boolean }) {
  if (!error) return null;
  const response = (error as { response?: { status?: number; data?: { error?: { message?: string } } } }).response;
  const focus = (event: FormEvent<HTMLButtonElement>, path: string) => {
    const root = event.currentTarget.closest('form') ?? document.querySelector('.cc-assessment-editor');
    const name = path.replace(/^answers\./, '');
    const labels: Record<string, string> = { scope: 'Compliance scope', objective: 'Assessment objective', ownerId: 'Assessment owner' };
    const field = Array.from(root?.querySelectorAll<HTMLElement>('input,select,textarea') ?? []).find(element => element.getAttribute('name') === name || element.getAttribute('aria-label') === labels[name]);
    if (field) {
      for (let parent = field.parentElement; parent; parent = parent.parentElement) if (parent instanceof HTMLDetailsElement) parent.open = true;
      field.focus();
      field.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  };
  return (
    <div role="alert" className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
      <p className="font-semibold">Your changes could not be saved.</p>
      <p>{response?.status === 403 ? 'You do not have permission to save this record. Ask an organisation administrator to check your access.' : response?.data?.error?.message ?? 'The server could not be reached. Check your connection and try again.'}</p>
      <ul className="space-y-1">{messages(error).map(item => <li key={item.path}><button type="button" className="text-left underline" onClick={event => focus(event, item.path)}>{item.path.replace(/^answers\./, '')}: {item.message}</button></li>)}</ul>
      <p>Your entered answers are still on this screen. Correct any errors and save again.</p>
      {retry && <button type="button" className="rounded-md border border-red-300 bg-white px-3 py-2 font-semibold" onClick={event => event.currentTarget.closest('form')?.requestSubmit()}>Retry saving current answers</button>}
    </div>
  );
}
