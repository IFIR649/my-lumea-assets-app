import type { ReactNode } from "react";
import type { Note } from "../lib/api";
import { copyText } from "../lib/clipboard";

function snippet(text: string, size = 140) {
  const clean = (text || "").replace(/\s+/g, " ").trim();
  return clean.length > size ? `${clean.slice(0, size)}...` : clean;
}

export function NoteCard({
  note,
  onOpen,
  toast,
  rightSlot,
}: {
  note: Note;
  onOpen: (note: Note) => void;
  toast: (kind: "success" | "error" | "info", msg: string) => void;
  rightSlot?: ReactNode;
}) {
  return (
    <div
      className="group relative h-[140px] cursor-pointer overflow-hidden rounded-2xl border border-slate-200 bg-white/75 p-4 hover:border-slate-300"
      onClick={() => onOpen(note)}
      title="Click para abrir"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-900">
            {note.pinned ? "📌 " : ""}
            {note.title}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {note.clientName || "Anonimo"}
            {note.ip ? ` • ${note.ip}` : ""}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {rightSlot}
          <button
            type="button"
            className="rounded-xl border border-slate-200 bg-white/80 px-2 py-1 text-xs font-semibold text-slate-700 opacity-0 group-hover:opacity-100"
            onClick={async (e) => {
              e.stopPropagation();
              const ok = await copyText(note.content);
              toast(ok ? "success" : "info", ok ? "Copiado." : "Selecciona y Ctrl+C.");
            }}
          >
            Copiar
          </button>
        </div>
      </div>

      <div className="mt-3 text-sm text-slate-700">{snippet(note.content)}</div>
    </div>
  );
}
