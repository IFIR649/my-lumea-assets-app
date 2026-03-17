import { useState } from 'react'
import { getClientName, setClientName } from '../lib/identity'

export function WhoAmIModal({
  open,
  onClose,
  onSaved
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(getClientName())

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="text-lg font-semibold text-slate-900">Cambiar identidad</div>

        <input
          className="mt-4 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
          placeholder="Tu nombre o alias"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />

        <div className="mt-5 flex justify-end gap-2">
          <button
            className="rounded-xl border border-slate-200 bg-white/70 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white"
            onClick={onClose}
            type="button"
          >
            Cancelar
          </button>

          <button
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            onClick={() => {
              setClientName(name.trim())
              onSaved()
              onClose()
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
