import { useEffect, useMemo, useState } from "react";
import { api, type FileItem } from "../lib/api";
import { Card, CardBody, CardHeader } from "./Card";
import { Dropzone } from "./Dropzone";

function fmt(ts: number | string) {
  const d = new Date(ts);
  return d.toLocaleString();
}

function fmtBytes(bytes: number) {
  const units = ["B", "KB", "MB", "GB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function isImage(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase();
  return ["jpg", "jpeg", "png", "gif", "webp"].includes(ext || "");
}

export function FilesPanel({
  toast,
}: {
  toast: (kind: "success" | "error" | "info", msg: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [busyUpload, setBusyUpload] = useState(false);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [query, setQuery] = useState("");

  async function refresh() {
    setLoading(true);
    try {
      const data = await api.listFiles();
      setFiles(data);
    } catch (e: any) {
      toast("error", `No pude cargar archivos: ${e?.message ?? "error"}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return files;
    return files.filter((f) => f.originalName.toLowerCase().includes(q));
  }, [files, query]);

  async function upload(file: File) {
    setBusyUpload(true);
    try {
      const meta = await api.uploadFile(file);
      setFiles((prev) => [meta, ...prev]);
      toast("success", "Archivo subido.");
    } catch (e: any) {
      toast("error", `No pude subir: ${e?.message ?? "error"}`);
    } finally {
      setBusyUpload(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader
          title="Compartir archivo"
          subtitle="Disponible en tu LAN. Se auto-eliminaran despues de 24 horas."
        />
        <CardBody>
          <Dropzone onFile={upload} disabled={busyUpload} />
          <div className="mt-3 text-xs text-slate-500">
            *Privacidad: Los archivos expiran automaticamente en el servidor para no dejar rastro permanente.
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Archivos compartidos"
          subtitle={loading ? "Cargando..." : `${files.length} total`}
          right={
            <button
              className="rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-white"
              onClick={refresh}
              type="button"
            >
              Refrescar
            </button>
          }
        />
        <CardBody>
          <input
            className="w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm outline-none placeholder:text-slate-400 focus:border-slate-400"
            placeholder="Buscar por nombre..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          <div className="mt-4 space-y-3">
            {filtered.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white/60 p-4 text-sm text-slate-500">
                No hay archivos que mostrar.
              </div>
            ) : (
              filtered.map((f) => {
                const image = isImage(f.originalName);
                return (
                  <div
                    key={f.id}
                    className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white/80 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      {image ? (
                        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm">
                          <img
                            src={api.downloadUrl(f.id)}
                            alt={f.originalName}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        </div>
                      ) : (
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-400 shadow-sm">
                          FILE
                        </div>
                      )}

                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-900">{f.originalName}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {f.clientName ? `por ${f.clientName}` : "por Anonimo"}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                          <span className="font-medium">{fmtBytes(f.size)}</span>
                          <span>|</span>
                          <span>{fmt(f.createdAt)}</span>
                        </div>
                      </div>
                    </div>

                    <a
                      className="inline-flex shrink-0 items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
                      href={api.downloadUrl(f.id)}
                      download={f.originalName}
                    >
                      Descargar
                    </a>
                  </div>
                );
              })
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
