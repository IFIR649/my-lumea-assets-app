import { useEffect, useState } from 'react'
import { adminApi, type ChatAuditRow } from '../lib/api'
import { Avatar } from './Avatar'
import { Card, CardBody, CardHeader } from './Card'

type ToastFn = (kind: 'success' | 'error' | 'info', msg: string) => void

export function ChatAuditPanel({ toast }: { toast: ToastFn }) {
  const [rows, setRows] = useState<ChatAuditRow[]>([])
  const [loading, setLoading] = useState(false)
  const [purging, setPurging] = useState(false)

  const [kind, setKind] = useState<'' | 'broadcast' | 'dm'>('')
  const [q, setQ] = useState('')
  const [fromId, setFromId] = useState('')
  const [toId, setToId] = useState('')
  const [cursor, setCursor] = useState<number | null>(null)
  const [exportDays, setExportDays] = useState(7)
  const [retentionDays, setRetentionDays] = useState(30)

  async function load(reset = true) {
    setLoading(true)
    try {
      const data = await adminApi.chatMessages({
        limit: 120,
        before: reset ? undefined : (cursor ?? undefined),
        kind,
        q,
        fromId,
        toId
      })

      setRows((prev) => (reset ? data.rows : [...prev, ...data.rows]).slice(0, 800))
      setCursor(data.nextCursor)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'error'
      toast('error', `No pude cargar auditoria: ${message}`)
    } finally {
      setLoading(false)
    }
  }

  async function purgeOldMessages() {
    const days = Number.isFinite(retentionDays) ? Math.max(1, retentionDays) : 30
    const ok = window.confirm(
      `Se borraran mensajes con antiguedad mayor a ${days} dias. Esta accion no se puede deshacer.`
    )
    if (!ok) return

    setPurging(true)
    try {
      const result = await adminApi.purgeChat(days)
      toast('success', `Purgado listo. Eliminados: ${result.deleted}`)
      load(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'error'
      toast('error', `No pude purgar mensajes: ${message}`)
    } finally {
      setPurging(false)
    }
  }

  useEffect(() => {
    load(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <Card>
      <CardHeader
        title="Auditoria de Chat (Admin)"
        subtitle="Mensajes guardados en SQLite. Filtra, busca, exporta y aplica retencion."
        right={
          <div className="flex gap-2">
            <button
              className="rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-white"
              onClick={() => load(true)}
              type="button"
            >
              {loading ? '...' : 'Refrescar'}
            </button>

            <button
              className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              onClick={() => {
                const days = Math.max(1, exportDays)
                const since = Date.now() - days * 24 * 60 * 60 * 1000
                window.open(adminApi.chatExportUrl(since), '_blank')
              }}
              type="button"
            >
              Export CSV
            </button>
          </div>
        }
      />

      <CardBody>
        <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Mensajes auditables por el administrador de esta red local.
        </div>

        <div className="grid gap-2 rounded-2xl border border-slate-200 bg-white/70 p-3 lg:grid-cols-4">
          <select
            className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm"
            value={kind}
            onChange={(e) => {
              const value = e.target.value
              if (value === 'broadcast' || value === 'dm') setKind(value)
              else setKind('')
            }}
          >
            <option value="">Todos</option>
            <option value="broadcast">Broadcast</option>
            <option value="dm">DM</option>
          </select>

          <input
            className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm"
            placeholder="Buscar texto..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          <input
            className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm"
            placeholder="fromId (opcional)"
            value={fromId}
            onChange={(e) => setFromId(e.target.value)}
          />

          <input
            className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm"
            placeholder="toId (solo DM)"
            value={toId}
            onChange={(e) => setToId(e.target.value)}
          />

          <div className="flex gap-2 lg:col-span-4">
            <button
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              onClick={() => {
                setCursor(null)
                load(true)
              }}
              type="button"
            >
              Aplicar filtros
            </button>
            <button
              className="rounded-xl border border-slate-200 bg-white/70 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white"
              onClick={() => {
                setKind('')
                setQ('')
                setFromId('')
                setToId('')
                setCursor(null)
                setTimeout(() => load(true), 0)
              }}
              type="button"
            >
              Limpiar
            </button>
          </div>
        </div>

        <div className="mt-3 grid gap-2 rounded-2xl border border-slate-200 bg-white/70 p-3 lg:grid-cols-2">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <div className="mb-1 text-xs font-semibold text-slate-700">
                Exportar ultimos N dias
              </div>
              <input
                className="w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm"
                type="number"
                min={1}
                value={exportDays}
                onChange={(e) => setExportDays(Number(e.target.value) || 1)}
              />
            </div>
            <button
              className="rounded-xl border border-slate-200 bg-white/70 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white"
              type="button"
              onClick={() => {
                const days = Math.max(1, exportDays)
                const since = Date.now() - days * 24 * 60 * 60 * 1000
                window.open(adminApi.chatExportUrl(since), '_blank')
              }}
            >
              Exportar
            </button>
          </div>

          <div className="flex items-end gap-2">
            <div className="flex-1">
              <div className="mb-1 text-xs font-semibold text-slate-700">
                Retencion: borrar mayores a N dias
              </div>
              <input
                className="w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm"
                type="number"
                min={1}
                value={retentionDays}
                onChange={(e) => setRetentionDays(Number(e.target.value) || 1)}
              />
            </div>
            <button
              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-900 hover:bg-rose-100 disabled:opacity-60"
              type="button"
              disabled={purging}
              onClick={purgeOldMessages}
            >
              {purging ? 'Purgando...' : 'Purgar'}
            </button>
          </div>
        </div>

        <div className="mt-3 h-[420px] space-y-2 overflow-auto rounded-2xl border border-slate-200 bg-white/60 p-3">
          {rows.length === 0 ? (
            <div className="text-sm text-slate-500">Sin mensajes.</div>
          ) : (
            rows.map((m) => (
              <div key={m.id} className="rounded-2xl border border-slate-200 bg-white/80 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <Avatar id={m.fromId} name={m.fromName} size={28} />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-900">
                        {m.fromName}
                      </div>
                      <div className="truncate font-mono text-[11px] text-slate-500">
                        {m.fromId}
                      </div>
                    </div>
                    <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                      {m.type === 'dm' ? 'DM' : 'Broadcast'}
                    </span>
                    {m.type === 'dm' && m.toId ? (
                      <span className="truncate font-mono text-[11px] text-slate-500">
                        to {m.toId}
                      </span>
                    ) : null}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {new Date(m.ts).toLocaleString()}
                  </div>
                </div>

                <div className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-900">
                  {m.text}
                </div>

                {m.type === 'dm' ? (
                  <div className="mt-2 text-[11px] text-slate-500">
                    Entregado:{' '}
                    {m.deliveredAt ? new Date(m.deliveredAt).toLocaleString() : 'pendiente'} -
                    Leido: {m.readAt ? new Date(m.readAt).toLocaleString() : '-'}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div className="text-xs text-slate-500">Mostrando {rows.length} (max 800 en UI)</div>
          <button
            className="rounded-xl border border-slate-200 bg-white/70 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white disabled:opacity-50"
            disabled={!cursor || loading}
            onClick={() => load(false)}
            type="button"
          >
            Cargar mas
          </button>
        </div>
      </CardBody>
    </Card>
  )
}
