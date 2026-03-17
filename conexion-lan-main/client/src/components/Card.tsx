import type React from 'react'

export function Card({
  children,
  className = ''
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={[
        'rounded-2xl border border-slate-200/70 bg-white/80 shadow-sm',
        'backdrop-blur supports-[backdrop-filter]:bg-white/60',
        className
      ].join(' ')}
    >
      {children}
    </div>
  )
}

export function CardHeader({
  title,
  subtitle,
  right
}: {
  title: string
  subtitle?: string
  right?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-200/60 px-5 py-4">
      <div>
        <div className="text-lg font-semibold text-slate-900">{title}</div>
        {subtitle ? <div className="mt-1 text-sm text-slate-500">{subtitle}</div> : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  )
}

export function CardBody({
  children,
  className = ''
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={['px-5 py-4', className].join(' ')}>{children}</div>
}
