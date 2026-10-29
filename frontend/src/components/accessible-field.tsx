import { useId, useLayoutEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Associates native inputs, including inputs rendered by Controller/Select. */
export function AccessibleField({ label, error, required, className, children }: {
  label: ReactNode; error?: string; required?: boolean; className?: string; children: ReactNode;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLLabelElement>(null);
  useLayoutEffect(() => {
    const control = root.current?.querySelector<HTMLElement>('input:not([type="hidden"]),select,textarea,[role="combobox"]');
    if (!control) return;
    if (!control.id) control.id = id;
    if (labelRef.current) labelRef.current.htmlFor = control.id;
    if (control.getAttribute('role') === 'combobox' && !control.hasAttribute('aria-label')) control.setAttribute('aria-labelledby', id + '-label');
    const descriptions = new Set((control.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean));
    descriptions.delete(id + '-error');
    const inlineError = root.current?.querySelector<HTMLElement>('p.text-red-600,p.text-rose-600,p[role=alert]');
    const hasError = Boolean(error || inlineError?.textContent?.trim());
    descriptions.delete(id + '-inline-error');
    if (error) descriptions.add(id + '-error');
    else if (inlineError?.textContent?.trim()) {
      if (!inlineError.id) inlineError.id=id+'-inline-error';
      inlineError.setAttribute('role','alert');
      descriptions.add(inlineError.id);
    }
    if (descriptions.size) control.setAttribute('aria-describedby', [...descriptions].join(' '));
    else control.removeAttribute('aria-describedby');
    if (hasError) control.setAttribute('aria-invalid', 'true');
    else if (control.getAttribute('aria-invalid') === 'true') control.removeAttribute('aria-invalid');
  }, [children, error, id]);
  return <div ref={root} className={cn('min-w-0 space-y-1.5', className)}>
    <label ref={labelRef} id={id + '-label'} className="block text-sm font-medium text-slate-700">{label}{required && <span aria-hidden="true" className="ml-1 text-red-600">*</span>}</label>
    {children}
    {error && <p id={id + '-error'} role="alert" className="text-xs text-red-700">{error}</p>}
  </div>;
}
