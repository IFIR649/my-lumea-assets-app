import { useEffect, useState } from 'react'
import { chatApi, apiFetch } from '../lib/api'
import { Avatar } from './Avatar'
import { Card, CardBody, CardHeader } from './Card'

type ToastFn = (kind: 'success' | 'error' | 'info', msg: string) => void

type UserRow = {
  clientId: string
  clientName: string | null
  ip: string
  online: boolean
  lastPing: number
  lastSeen: number
}

type DuplicateName = { nameKey: string; count: number }

async function loadUsers(): Promise<{ users: UserRow[]; duplicates: DuplicateName[] }> {
  const res = await apiFetch('/api/admin/users')
  if (!res.ok) throw new Error(await res.text())
  return res.json() as Promise<{ users: UserRow[]; duplicates: DuplicateName[] }>
}

export function UserDirectory({ toast }: { toast: ToastFn }) {
  const [users, setUsers] = useState<UserRow[]>([])
  const [dups, setDups] = useState<DuplicateName[]>([])
  const [toId, setToId] = useState('')
  const [dmText, setDmText] = useState('')

  async function refresh() {
    try {
      const data = await loadUsers()
      setUsers(data.users)
      setDups(data.duplicates || [])
      if (toId && !data.users.some((u) => u.clientId === toId)) {
        setToId('')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'error'
      toast('error', `No pude cargar usuarios: ${message}`)
    }
  }

  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 4000)
    return () => clearInterval(t)
  }, [])

  async function sendDm() {
    const text = dmText.trim()
    if (!toId || !text) return
    setDmText('')
    try {
      const result = await chatApi.dm(toId, text)
      toast(
        'success',
        result.delivered ? 'DM enviado' : 'DM guardado (destino no conectado al chat)'
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : 'error'
      toast('error', `No pude mandar DM: ${message}`)
    }
  }

  return (
    <Card>
      <CardHeader
        title="Usuarios (online + duplicados)"
        subtitle={`${users.filter((u) => u.online).length} online - ${users.length} total`}
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
        {dups.length > 0 ? (
          <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <div className="font-semibold">Nombres duplicados detectados</div>
            <div className="mt-1 text-xs">
              {dups.map((d) => `${d.nameKey} (${d.count})`).join(' - ')}
            </div>
          </div>
        ) : null}

        <div className="grid gap-2">
          {users.map((u) => (
            <button
              key={u.clientId}
              onClick={() => setToId(u.clientId)}
              className={[
                'flex items-center justify-between gap-3 rounded-2xl border bg-white/80 p-3 text-left',
                toId === u.clientId ? 'border-slate-900' : 'border-slate-200 hover:border-slate-300'
              ].join(' ')}
              type="button"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Avatar id={u.clientId} name={u.clientName || 'Sin nombre'} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-900">
                    {u.clientName || 'Sin nombre'}
                  </div>
                  <div className="truncate font-mono text-xs text-slate-500">{u.ip}</div>
                </div>
              </div>
              <span
                className={[
                  'rounded-xl px-2 py-1 text-xs font-semibold',
                  u.online ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-100 text-slate-700'
                ].join(' ')}
              >
                {u.online ? 'Online' : 'Offline'}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-white/70 p-3">
          <div className="text-sm font-semibold text-slate-900">Mensaje directo</div>
          <div className="mt-2 text-xs text-slate-500">
            Selecciona un usuario arriba y envia un DM. (Se entrega si esta conectado al chat)
          </div>

          <div className="mt-3 flex gap-2">
            <input
              className="flex-1 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm outline-none focus:border-slate-400"
              placeholder={toId ? 'Escribe tu DM...' : 'Selecciona un usuario...'}
              value={dmText}
              onChange={(e) => setDmText(e.target.value)}
              disabled={!toId}
              onKeyDown={(e) => {
                if (e.key === 'Enter') sendDm()
              }}
            />
            <button
              className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              disabled={!toId || !dmText.trim()}
              onClick={sendDm}
              type="button"
            >
              Enviar
            </button>
          </div>
        </div>
      </CardBody>
    </Card>
  )
}
