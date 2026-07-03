import { useState, useRef, useEffect } from 'react';
import { Check, Plus, X, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEvidenceTags, useCreateTag } from '../hooks/use-evidence';

interface TagSelectorProps {
  selected: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}

export function TagSelector({ selected, onChange, disabled }: TagSelectorProps) {
  const { data: tags = [], isLoading } = useEvidenceTags();
  const createTag = useCreateTag();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = tags.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase()),
  );

  const selectedTags = tags.filter((t) => selected.includes(t.id));
  const canCreate = search.trim().length > 0 && !tags.some((t) => t.name.toLowerCase() === search.toLowerCase());

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  };

  const handleCreate = async () => {
    const tag = await createTag.mutateAsync({ name: search.trim() });
    onChange([...selected, tag.id]);
    setSearch('');
  };

  return (
    <div ref={ref} className="relative">
      {/* Selected tag pills */}
      <div
        className={cn(
          'flex min-h-[38px] flex-wrap gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm',
          open && 'ring-2 ring-blue-500 border-blue-500',
          disabled && 'cursor-not-allowed bg-slate-50 opacity-60',
        )}
        onClick={() => !disabled && setOpen(true)}
      >
        {selectedTags.map((tag) => (
          <span
            key={tag.id}
            className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-white"
            style={{ backgroundColor: tag.color }}
          >
            {tag.name}
            {!disabled && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); toggle(tag.id); }}
                className="ml-0.5 rounded-full hover:opacity-80"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}
        {selectedTags.length === 0 && (
          <span className="text-slate-400 flex items-center gap-1.5">
            <Tag className="h-3.5 w-3.5" />
            Add tags...
          </span>
        )}
      </div>

      {/* Dropdown */}
      {open && !disabled && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg">
          <div className="p-2">
            <input
              type="text"
              placeholder="Search or create tag..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {isLoading && (
              <p className="px-3 py-2 text-sm text-slate-500">Loading...</p>
            )}
            {filtered.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggle(tag.id)}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50"
              >
                <span
                  className="h-3 w-3 rounded-full shrink-0"
                  style={{ backgroundColor: tag.color }}
                />
                <span className="flex-1 text-left">{tag.name}</span>
                {selected.includes(tag.id) && <Check className="h-4 w-4 text-blue-600" />}
              </button>
            ))}
            {canCreate && (
              <button
                type="button"
                onClick={handleCreate}
                disabled={createTag.isPending}
                className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                Create "{search.trim()}"
              </button>
            )}
            {!isLoading && filtered.length === 0 && !canCreate && (
              <p className="px-3 py-2 text-sm text-slate-500">No tags found.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
