export type TabKey = 'notes' | 'files' | 'chat' | 'admin'

export function Tabs({
  value,
  onChange,
  showAdmin
}: {
  value: TabKey
  onChange: (v: TabKey) => void
  showAdmin: boolean
}) {
  const tabBase = 'rounded-xl px-3 py-2 text-sm font-medium transition border'
  const on = 'bg-slate-900 text-white border-slate-900 shadow-sm'
  const off = 'bg-white/70 text-slate-700 border-slate-200 hover:bg-white'

  return (
    <div className="flex gap-2 rounded-2xl bg-slate-100/70 p-2">
      <button
        className={[tabBase, value === 'notes' ? on : off].join(' ')}
        onClick={() => onChange('notes')}
        type="button"
      >
        Textos
      </button>
      <button
        className={[tabBase, value === 'files' ? on : off].join(' ')}
        onClick={() => onChange('files')}
        type="button"
      >
        Archivos
      </button>
      <button
        className={[tabBase, value === 'chat' ? on : off].join(' ')}
        onClick={() => onChange('chat')}
        type="button"
      >
        Chat
      </button>

      {showAdmin && (
        <button
          className={[tabBase, value === 'admin' ? on : off].join(' ')}
          onClick={() => onChange('admin')}
          type="button"
        >
          Admin
        </button>
      )}
    </div>
  )
}
