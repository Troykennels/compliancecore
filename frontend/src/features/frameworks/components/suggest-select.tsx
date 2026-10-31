import { assessmentInput } from './assessment-records';

/** A dropdown of editable starting wording. Choosing one fills an empty field or adds a new line; nothing is saved until the form is saved. */
export function SuggestSelect({
  label,
  options,
  value,
  onPick,
  disabled,
}: {
  label: string;
  options: string[];
  value: string;
  onPick: (next: string) => void;
  disabled?: boolean;
}): JSX.Element | null {
  if (!options.length || disabled) return null;
  return (
    <select
      aria-label={label}
      className={assessmentInput + ' border-dashed text-slate-600'}
      value=""
      onChange={(e) => {
        const v = e.target.value;
        if (!v) return;
        onPick(value.trim() ? value.trimEnd() + '\n' + v : v);
      }}
    >
      <option value="">{label}…</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o.length > 120 ? o.slice(0, 117) + '…' : o}
        </option>
      ))}
    </select>
  );
}
