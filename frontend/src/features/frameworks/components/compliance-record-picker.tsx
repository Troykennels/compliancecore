import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
type Option = { id: string; title: string; type?: string };
type Props = {
  name: string;
  label: string;
  source: string;
  kind: string;
  options: Option[];
  initial: string | string[];
  multiple?: boolean;
  required?: boolean;
  allowedType?: string;
  onChange?: (value: string) => void;
};
export function ComplianceRecordPicker(p: Props) {
  const [search, setSearch] = useState(""),
    [selected, setSelected] = useState<string[]>(
      Array.isArray(p.initial) ? p.initial : p.initial ? [p.initial] : [],
    ),
    [known, setKnown] = useState(p.options);
  const query = useQuery({
    queryKey: ["compliance-picker", p.kind, p.source, search],
    enabled: search.length >= 2 && p.source !== "sourceKinds",
    queryFn: async () =>
      (
        await apiClient.get<{ data: Option[] }>(
          `/frameworks/records/${p.kind}/options`,
          { params: { source: p.source, q: search } },
        )
      ).data.data,
  });
  const options = (search.length >= 2 ? (query.data ?? []) : p.options).filter(
    (o) => !p.allowedType || o.type === p.allowedType,
  );
  const choices = [
    ...options,
    ...known.filter(
      (o) => selected.includes(o.id) && !options.some((v) => v.id === o.id),
    ),
  ];
  function choose(id: string) {
    setKnown((prev) => [
      ...prev,
      ...options.filter((o) => !prev.some((v) => v.id === o.id)),
    ]);
    setSelected(
      p.multiple
        ? selected.includes(id)
          ? selected.filter((v) => v !== id)
          : [...selected, id]
        : id
          ? [id]
          : [],
    );
    p.onChange?.(id);
  }
  const style =
    "w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";
  return (
    <div className="min-w-0 space-y-2">
      {p.source !== "sourceKinds" && (
        <input
          aria-label={"Find matching " + p.source + " records"}
          className={style}
          placeholder="Type at least 2 letters to search all records"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      )}
      {query.isFetching && (
        <p role="status" className="text-xs text-slate-500">
          Finding records…
        </p>
      )}
      {query.isError && (
        <p role="alert" className="text-xs text-red-800">
          Search unavailable.{" "}
          <button
            type="button"
            className="underline"
            onClick={() => void query.refetch()}
          >
            Retry
          </button>
        </p>
      )}
      {p.multiple ? (
        <>
          <div
            role="group"
            aria-label={p.label}
            className="max-h-48 space-y-1 overflow-auto rounded-lg border bg-white p-2"
          >
            {choices.map((o, i) => (
              <label
                key={o.id}
                className="flex cursor-pointer items-start gap-2 rounded p-1 text-sm hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={selected.includes(o.id)}
                  required={p.required && selected.length === 0 && i === 0}
                  onChange={() => choose(o.id)}
                />
                <span>{o.title}</span>
              </label>
            ))}
            {!choices.length && (
              <p className="text-xs text-slate-500">
                No matching records. Prepare the source record or upload the
                supporting document first.
              </p>
            )}
          </div>
          {selected.map((v) => (
            <input key={v} type="hidden" name={p.name} value={v} />
          ))}
          <p className="text-xs text-slate-500">
            {selected.length} selected. Tick each record you need.
          </p>
        </>
      ) : (
        <select
          aria-label={p.label}
          className={style}
          name={p.name}
          required={p.required}
          value={selected[0] ?? ""}
          onChange={(e) => choose(e.target.value)}
        >
          <option value="">Choose a named record</option>
          {choices.map((o) => (
            <option key={o.id} value={o.id}>
              {o.type ? o.type.replace(/_/g, " ") + " — " : ""}
              {o.title}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
