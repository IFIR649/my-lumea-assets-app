import { useEffect, useMemo, useState } from 'react'
import { Card, CardBody, CardHeader } from './Card'
import { apiFetch } from '../lib/api'

type Visitor = {
  ip: string
  clientId?: string | null
  clientName?: string | null
  firstSeen: number
  lastSeen: number
  hits: number
  lastPath: string
  userAgent: string
  isActive: boolean
}

function fmt(ts: number) {
  return new Date(ts).toLocaleString()
}

function ago(ms: number) {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  return `${h}h`
}

async function getVisitors(activeMinutes: number) {
  const res = await apiFetch(`/api/admin/visitors?activeMinutes=${activeMinutes}`)
  if (!res.ok) throw new Error(await res.text())
  return res.json() as Promise<{
    total: number
    active: number
    activeMinutes: number
    visitors: Visitor[]
  }>
}

async function clearVisitors() {
  const res = await apiFetch('/api/admin/visitors/clear', { method: 'POST' })
  if (!res.ok) throw new Error(await res.text())
  return res.json() as Promise<{ ok: true }>
}

export function VisitorsPanel({
  toast
}: {
  toast: (kind: 'success' | 'error' | 'info', msg: string) => void
}) {
  const [activeMinutes, setActiveMinutes] = useState(5)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<{
    total: number
    active: number
    visitors: Visitor[]
  } | null>(null)

  const canShow = useMemo(() => {
    const h = window.location.hostname
    return h === 'localhost' || h === '127.0.0.1'
  }, [])

  async function refresh() {
    setLoading(true)
    try {
      const d = await getVisitors(activeMinutes)
      setData({ total: d.total, active: d.active, visitors: d.visitors })
    } catch (e: any) {
      toast('error', `No pude cargar accesos: ${e?.message ?? 'error'}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!canShow) return
    refresh()
    const t = setInterval(refresh, 4000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canShow, activeMinutes])

  if (!canShow) return null

  return (
    <Card>
      <CardHeader
        title="Accesos (IPs)"
        subtitle={
          data
            ? `${data.active} activos (<=${activeMinutes} min) - ${data.total} total`
            : 'Cargando...'
        }
        right={
          <div className="flex items-center gap-2">
            <select
              className="rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-sm"
              value={activeMinutes}
              onChange={(e) => setActiveMinutes(Number(e.target.value))}
            >
              <option value={1}>Activos 1 min</option>
              <option value={3}>Activos 3 min</option>
              <option value={5}>Activos 5 min</option>
              <option value={10}>Activos 10 min</option>
              <option value={30}>Activos 30 min</option>
            </select>

            <button
              className="rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-white"
              onClick={refresh}
              type="button"
            >
              {loading ? '...' : 'Refrescar'}
            </button>

            <button
              className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-900 hover:bg-rose-100"
              onClick={async () => {
                try {
                  await clearVisitors()
                  toast('success', 'Historial de accesos limpiado.')
                  refresh()
                } catch (e: any) {
                  toast('error', `No pude limpiar: ${e?.message ?? 'error'}`)
                }
              }}
              type="button"
            >
              Limpiar
            </button>
          </div>
        }
      />
      <CardBody>
        {!data || data.visitors.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white/60 p-4 text-sm text-slate-500">
            Aun no hay accesos registrados.
          </div>
        ) : (
          <div className="space-y-2">
            {data.visitors.map((v) => (
              <div key={v.ip} className="rounded-2xl border border-slate-200 bg-white/80 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-semibold text-slate-900 truncate">
                      {v.clientName || 'Sin nombre'}
                    </span>
                    <span className="font-mono text-xs text-slate-600">{v.ip}</span>
                    <span
                      className={[
                        'rounded-xl px-2 py-1 text-xs font-semibold',
                        v.isActive
                          ? 'bg-emerald-100 text-emerald-900'
                          : 'bg-slate-100 text-slate-700'
                      ].join(' ')}
                    >
                      {v.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                    <span className="text-xs text-slate-500">hits {v.hits}</span>
                  </div>

                  <div className="text-xs text-slate-500">
                    ultimo: {fmt(v.lastSeen)} ({ago(Date.now() - v.lastSeen)} ago)
                  </div>
                </div>

                <div className="mt-2 grid gap-1 text-xs text-slate-600">
                  <div>
                    <span className="text-slate-500">primero:</span> {fmt(v.firstSeen)}
                  </div>
                  <div className="truncate">
                    <span className="text-slate-500">ultima ruta:</span>{' '}
                    <span className="font-mono">{v.lastPath}</span>
                  </div>
                  {v.userAgent ? (
                    <div className="truncate">
                      <span className="text-slate-500">UA:</span> {v.userAgent}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  )
}
