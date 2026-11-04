import { useState } from 'react';

/** Refresh clean fields, but keep local edits until the server confirms them.
 * Section keys keep separate drafts when navigating within an assessment.
 * Deliberately memory-only: sensitive answers are not stored in the browser.
 */
export function useAssessmentDraft(key: string, saved: string) {
  const [drafts, setDrafts] = useState<Record<string, { base: string; value: string }>>({});
  const current = drafts[key];
  if (!current || current.base !== saved) {
    setDrafts({
      ...drafts,
      [key]: { base: saved, value: !current || current.value === current.base ? saved : current.value },
    });
  }
  const value = !current || current.value === current.base ? saved : current.value;
  const setValue = (next: string) => setDrafts(previous => ({ ...previous, [key]: { base: saved, value: next } }));
  const dirty = value !== saved || Object.entries(drafts).some(([section, draft]) => section !== key && draft.value !== draft.base);
  return [value, setValue, dirty] as const;
}
