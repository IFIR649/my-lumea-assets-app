export function colorFromId(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) >>> 0
  const hue = h % 360
  return `hsl(${hue} 70% 45%)`
}

export function initials(name?: string | null) {
  const s = (name || '').trim()
  if (!s) return '?'
  const parts = s.split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?'
}

export function Avatar({
  name,
  id,
  size = 34
}: {
  name?: string | null
  id: string
  size?: number
}) {
  const bg = colorFromId(id)
  const text = initials(name)
  return (
    <div
      className="grid select-none place-items-center rounded-full font-bold text-white"
      style={{ width: size, height: size, background: bg }}
      title={name || 'Sin nombre'}
    >
      <span style={{ fontSize: Math.max(12, Math.floor(size * 0.42)) }}>{text}</span>
    </div>
  )
}
