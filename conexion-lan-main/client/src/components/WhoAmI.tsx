import { useEffect, useState } from 'react'
import { getClientName, setClientName } from '../lib/identity'

export function WhoAmI({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')

  useEffect(() => {
    const n = getClientName()
    if (!n) {
      setOpen(true)
    } else {
      setName(n)
    }
  }, [])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="text-lg font-semibold text-slate-900">Quien eres?</div>
        <div className="mt-1 text-sm text-slate-500">
          Pon tu nombre o un alias. Se mostrara junto a tu IP en actividad y mensajes.
        </div>

        <input
          className="mt-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
          placeholder="tu nombre o lo que haces"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const v = name.trim()
              if (!v) return
              setClientName(v)
              setOpen(false)
              onDone()
            }
          }}
          autoFocus
        />

        <div className="mt-4 flex justify-end gap-2">
          <button
            className="rounded-xl border border-slate-200 bg-white/70 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white"
            onClick={() => {
              setOpen(false)
              onDone()
            }}
            type="button"
          >
            Omitir
          </button>
          <button
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            onClick={() => {
              const v = name.trim()
              if (!v) return
              setClientName(v)
              setOpen(false)
              onDone()
            }}
            type="button"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  )
}
