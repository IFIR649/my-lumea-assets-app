import { useEffect, useMemo, useState } from 'react'
import { adminNotesApi, notesApi, type Note } from '../lib/api'
import { NoteCard } from './NoteCard'
import { NoteViewerModal } from './NoteViewerModal'

function isLocalhost() {
  const host = window.location.hostname
  return host === 'localhost' || host === '127.0.0.1'
}

function pageWindow(current: number, total: number, size = 4) {
  const start = Math.max(1, Math.min(current, Math.max(1, total - size + 1)))
  const end = Math.min(total, start + size - 1)
  const pages = []

  for (let page = start; page <= end; page += 1) {
    pages.push(page)
  }

  return pages
}

export function NotesPanel({
  toast
}: {
  toast: (kind: 'success' | 'error' | 'info', msg: string) => void
}) {
  const [top, setTop] = useState<{ pinned: Note[]; latest: Note[] } | null>(null)
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState<{
    total: number
    totalPages: number
    rows: Note[]
  } | null>(null)
  const [viewer, setViewer] = useState<Note | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')

  const canAdmin = isLocalhost()

  async function refreshTop() {
    try {
      const data = await notesApi.top()
      setTop(data)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'error'
      toast('error', `No pude cargar top: ${message}`)
    }
  }

  async function refreshSearch() {
    try {
      const data = await notesApi.search(q, page)
      setSearch({ total: data.total, totalPages: data.totalPages, rows: data.rows })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'error'
      toast('error', `No pude buscar: ${message}`)
    }
  }

  useEffect(() => {
    void refreshTop()
  }, [])

  useEffect(() => {
    void refreshSearch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, page])

  const shared = useMemo(() => {
    const pinned = top?.pinned ?? []
    const latest = top?.latest ?? []
    const pinnedIds = new Set(pinned.map((note) => note.id))

    return [...pinned, ...latest.filter((note) => !pinnedIds.has(note.id))]
  }, [top])

  const pages = useMemo(() => {
    const totalPages = search?.totalPages || 1
    return pageWindow(page, totalPages, 4)
  }, [page, search?.totalPages])

  async function createNote() {
    const nextTitle = title.trim().slice(0, 60)
    const nextContent = content.trim()

    if (!nextTitle) return toast('info', 'Pon un titulo (max 60).')
    if (!nextContent) return toast('info', 'Pon el contenido.')

    try {
      await notesApi.create(nextTitle, nextContent)
      setTitle('')
      setContent('')
      toast('success', 'Nota creada.')
      await refreshTop()
      await refreshSearch()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'error'
      toast('error', `No pude crear: ${message}`)
    }
  }

  async function togglePin(note: Note) {
    if (!canAdmin) return

    try {
      await adminNotesApi.pin(note.id, note.pinned === 0)
      toast('success', note.pinned ? 'Desanclada.' : 'Anclada.')
      await refreshTop()
      await refreshSearch()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'error'
      toast('error', `No pude anclar: ${message}`)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-slate-200 bg-white/70 p-4">
        <div className="text-sm font-semibold text-slate-900">Nueva nota</div>
        <div className="mt-3 grid gap-2">
          <input
            className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm outline-none focus:border-slate-400"
            placeholder="Titulo (max 60)"
            value={title}
            maxLength={60}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className="min-h-[120px] rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm outline-none focus:border-slate-400"
            placeholder="Escribe el texto..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <div className="flex justify-end">
            <button
              className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
              onClick={createNote}
              type="button"
            >
              Compartir
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white/70 p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-900">Notas compartidas</div>
            <div className="text-xs text-slate-500">Se muestran ancladas + las ultimas 5</div>
          </div>
          <button
            className="rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-white"
            onClick={() => {
              void refreshTop()
            }}
            type="button"
          >
            Refrescar
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shared.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 text-sm text-slate-500">
              Aun no hay notas.
            </div>
          ) : (
            shared.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                toast={toast}
                onOpen={(selected) => setViewer(selected)}
                rightSlot={
                  canAdmin ? (
                    <button
                      type="button"
                      className="rounded-xl border border-slate-200 bg-white/80 px-2 py-1 text-xs font-semibold text-slate-700 opacity-0 group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation()
                        void togglePin(note)
                      }}
                      title={note.pinned ? 'Desanclar' : 'Anclar'}
                    >
                      {note.pinned ? '📌' : '📍'}
                    </button>
                  ) : null
                }
              />
            ))
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white/70 p-4">
        <div className="text-sm font-semibold text-slate-900">Buscar notas</div>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            className="flex-1 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm outline-none focus:border-slate-400"
            placeholder="Buscar por titulo, contenido o usuario..."
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setPage(1)
            }}
          />
          <button
            className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-white"
            onClick={() => {
              void refreshSearch()
            }}
            type="button"
          >
            Buscar
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(search?.rows ?? []).slice(0, 10).map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              toast={toast}
              onOpen={(selected) => setViewer(selected)}
            />
          ))}

          {(search?.rows?.length ?? 0) === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 text-sm text-slate-500">
              Sin resultados.
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            type="button"
            className="rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-white disabled:opacity-50"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            &larr;
          </button>

          {pages.map((pageNumber) => (
            <button
              key={pageNumber}
              type="button"
              className={[
                'rounded-xl px-3 py-2 text-sm font-semibold',
                pageNumber === page
                  ? 'bg-slate-900 text-white'
                  : 'border border-slate-200 bg-white/70 text-slate-700 hover:bg-white'
              ].join(' ')}
              onClick={() => setPage(pageNumber)}
            >
              {pageNumber}
            </button>
          ))}

          <button
            type="button"
            className="rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-white disabled:opacity-50"
            disabled={page >= (search?.totalPages || 1)}
            onClick={() => setPage((current) => Math.min(search?.totalPages || 1, current + 1))}
          >
            &rarr;
          </button>
        </div>

        <div className="mt-2 text-center text-xs text-slate-500">
          Pagina {page} de {search?.totalPages || 1} • {search?.total || 0} notas
        </div>
      </div>

      <NoteViewerModal
        open={Boolean(viewer)}
        note={viewer}
        onClose={() => setViewer(null)}
        toast={toast}
      />
    </div>
  )
}
