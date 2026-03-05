import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Note } from "../lib/api";
import { copyText } from "../lib/clipboard";

export function NoteViewerModal({
  open,
  note,
  onClose,
  toast,
}: {
  open: boolean;
  note: Note | null;
  onClose: () => void;
  toast: (kind: "success" | "error" | "info", msg: string) => void;
}) {
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!open) return;
    setQ("");
  }, [open, note?.id]);

  if (!open || !note) return null;

  const needle = q.trim();

  const renderContent = () => {
    if (!needle) {
      return (
        <div
          className={[
            "max-w-none break-words text-sm text-slate-900",
            "[&_p]:my-2",
            "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5",
            "[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5",
            "[&_li]:my-1",
            "[&_blockquote]:my-3 [&_blockquote]:border-l-4 [&_blockquote]:border-slate-300 [&_blockquote]:pl-4 [&_blockquote]:text-slate-600",
            "[&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-slate-800 [&_pre]:p-3 [&_pre]:text-slate-100",
            "[&_code]:rounded-md [&_code]:bg-slate-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-rose-600",
            "[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-inherit",
            "[&_a]:text-sky-700 [&_a]:underline",
            "[&_table]:my-3 [&_table]:w-full [&_table]:border-collapse",
            "[&_th]:border [&_th]:border-slate-200 [&_th]:bg-slate-50 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left",
            "[&_td]:border [&_td]:border-slate-200 [&_td]:px-2 [&_td]:py-1",
          ].join(" ")}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{note.content}</ReactMarkdown>
        </div>
      );
    }

    const chunks = note.content.split(needle);
    return (
      <pre className="whitespace-pre-wrap break-words">
        {chunks.map((chunk, index) => (
          <span key={index}>
            {chunk}
            {index < chunks.length - 1 ? (
              <mark className="rounded bg-amber-200 px-1">{needle}</mark>
            ) : null}
          </span>
        ))}
      </pre>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 p-3 sm:p-6" onMouseDown={onClose}>
      <div
        className="mx-auto flex h-[92vh] max-w-3xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-4">
          <div className="min-w-0">
            <div className="truncate text-base font-semibold text-slate-900">
              {note.pinned ? "📌 " : ""}
              {note.title}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {note.clientName || "Anonimo"}
              {note.ip ? ` • ${note.ip}` : ""}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-white"
              onClick={async () => {
                const ok = await copyText(note.content);
                toast(ok ? "success" : "info", ok ? "Copiado al portapapeles." : "Selecciona y Ctrl+C.");
              }}
              type="button"
            >
              Copiar
            </button>
            <button
              className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              onClick={onClose}
              type="button"
            >
              Cerrar
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 border-b border-slate-200 p-3">
          <input
            className="w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-2 text-sm outline-none focus:border-slate-400"
            placeholder="Buscar dentro del texto..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {q ? (
            <button
              className="rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-white"
              onClick={() => setQ("")}
              type="button"
            >
              Limpiar
            </button>
          ) : null}
        </div>

        <div className="flex-1 overflow-auto p-4 text-sm text-slate-900">{renderContent()}</div>
      </div>
    </div>
  );
}
