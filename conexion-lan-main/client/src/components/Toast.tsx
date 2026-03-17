import { useEffect } from 'react'

export type ToastKind = 'success' | 'error' | 'info'

export function Toast({
  open,
  kind,
  message,
  onClose,
  ms = 2500
}: {
  open: boolean
  kind: ToastKind
  message: string
  onClose: () => void
  ms?: number
}) {
  useEffect(() => {
    if (!open) return
    const t = setTimeout(onClose, ms)
    return () => clearTimeout(t)
  }, [open, ms, onClose])

  if (!open) return null

  const color =
    kind === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
      : kind === 'error'
        ? 'border-rose-200 bg-rose-50 text-rose-900'
        : 'border-slate-200 bg-white text-slate-900'

  return (
    <div className="fixed bottom-5 left-1/2 z-50 w-[min(520px,calc(100%-24px))] -translate-x-1/2">
      <div className={`rounded-2xl border px-4 py-3 shadow-lg ${color}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm">{message}</div>
          <button
            className="rounded-lg px-2 py-1 text-xs font-medium hover:bg-black/5"
            onClick={onClose}
            type="button"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
