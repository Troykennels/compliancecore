import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { complianceDownload } from "../compliance-download";
type Template = {
  id: string;
  title: string;
  route: string;
  content: string;
  purpose: string;
  fields: string[];
};
export function ComplianceTemplateLibrary() {
  const query = useQuery({
    queryKey: ["compliance-template-library"],
    queryFn: async () =>
      (
        await apiClient.get<{ data: Template[] }>(
          "/frameworks/records/templates",
        )
      ).data.data,
  });
  const [error, setError] = useState(""),
    [busy, setBusy] = useState("");
  async function download(id: string, format: string) {
    setBusy(id + format);
    setError("");
    try {
      await complianceDownload(
        `/frameworks/records/templates/${id}/download?format=${format}`,
        `${id}-template.${format}`,
      );
    } catch {
      setError("The document could not be downloaded. Try again.");
    } finally {
      setBusy("");
    }
  }
  return (
    <section className="space-y-4 border-t pt-6">
      <h2 className="text-xl font-semibold">
        Other compliance forms and working templates
      </h2>
      <p className="max-w-3xl text-sm text-slate-600">
        Use these optional editable forms to prepare the facts, then save them
        in the linked workflow and attach supporting evidence. Downloads do not
        create approved records or import data automatically.
      </p>
      {(error || query.isError) && (
        <p role="alert" className="text-sm text-red-800">
          {error || "Templates could not be loaded."}
          <button
            className="ml-3 underline"
            onClick={() => void query.refetch()}
          >
            Retry
          </button>
        </p>
      )}
      {query.isLoading ? (
        <p role="status">Loading working templates…</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {query.data?.map((t) => (
            <article
              key={t.id}
              className="space-y-3 rounded-xl border bg-white p-4"
            >
              <h3 className="font-semibold">{t.title}</h3>
              <p className="text-xs text-slate-600">
                {t.fields.slice(0, 4).join(" · ")}…
              </p>
              <div className="flex flex-wrap gap-3 text-sm">
                <button
                  className="text-indigo-700 underline disabled:opacity-40"
                  disabled={Boolean(busy)}
                  onClick={() => void download(t.id, "docx")}
                >
                  Word form
                </button>
                <button
                  className="text-indigo-700 underline disabled:opacity-40"
                  disabled={Boolean(busy)}
                  onClick={() => void download(t.id, "csv")}
                >
                  Spreadsheet headings
                </button>
                <Link className="text-indigo-700 underline" to={t.route}>
                  Open related workflow
                </Link>
              </div>
              <details>
                <summary className="cursor-pointer text-xs text-slate-700">
                  Read instructions and fields
                </summary>
                <p className="mt-2 whitespace-pre-wrap text-xs text-slate-600">
                  {t.content}
                </p>
              </details>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
