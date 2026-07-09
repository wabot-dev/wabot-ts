import type { ComponentChildren } from '@/ui'

export function KpiCard({
  label,
  value,
  sub,
}: {
  label: string
  value: string | number
  sub?: string
}) {
  return (
    <div class="kpi">
      <div class="kpi-value">{value}</div>
      <div class="kpi-label">{label}</div>
      {sub ? <div class="kpi-sub">{sub}</div> : null}
    </div>
  )
}

export function BarList({ items }: { items: { name: string; count: number }[] }) {
  if (items.length === 0) return <p class="empty">Sin datos</p>
  const max = Math.max(1, ...items.map((i) => i.count))
  return (
    <ul class="bars">
      {items.map((i) => (
        <li>
          <span class="bar-label">{i.name}</span>
          <span class="bar-track">
            <span class="bar-fill" style={`width:${Math.round((i.count / max) * 100)}%`} />
          </span>
          <span class="bar-count">{i.count.toLocaleString('en-US')}</span>
        </li>
      ))}
    </ul>
  )
}

export function Section({ title, children }: { title: string; children: ComponentChildren }) {
  return (
    <section class="section">
      <h2>{title}</h2>
      {children}
    </section>
  )
}
