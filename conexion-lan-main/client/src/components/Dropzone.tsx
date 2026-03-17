import type React from 'react'
import { useCallback, useMemo, useState } from 'react'

export function Dropzone({
  onFile,
  disabled
}: {
  onFile: (file: File) => void
  disabled?: boolean
}) {
  const [dragOver, setDragOver] = useState(false)

  const cls = useMemo(() => {
    const base = 'rounded-2xl border border-dashed p-6 transition bg-white/70'
    const state = disabled
      ? 'opacity-60'
      : dragOver
        ? 'border-slate-900 bg-slate-50'
        : 'border-slate-300 hover:border-slate-400'
    return `${base} ${state}`
  }, [dragOver, disabled])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      if (disabled) return
      setDragOver(false)
      const file = e.dataTransfer.files?.[0]
      if (file) onFile(file)
    },
    [disabled, onFile]
  )

  return (
    <div
      className={cls}
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled) setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <div className="flex flex-col items-center text-center">
        <div className="text-sm font-semibold text-slate-900">Arrastra un archivo aqui</div>
        <div className="mt-1 text-sm text-slate-500">o seleccionalo desde tu equipo</div>

        <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800">
          <input
            type="file"
            className="hidden"
            disabled={disabled}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onFile(f)
              e.currentTarget.value = ''
            }}
          />
          Elegir archivo
        </label>

        <div className="mt-3 text-xs text-slate-400">Tip: archivos grandes tardan mas en LAN.</div>
      </div>
    </div>
  )
}
