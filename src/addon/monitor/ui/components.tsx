import type { ComponentChildren } from '@/ui'
import { MONITOR_CSS } from './styles'

export function KpiCard({
  label,
  value,
  sub,
  href,
}: {
  label: string
  value: string | number
  sub?: string
  href?: string
}) {
  const body = (
    <>
      <div class="kpi-value">{value}</div>
      <div class="card-label">{label}</div>
      {sub ? <div class="kpi-sub">{sub}</div> : null}
    </>
  )
  return href ? <a class="card kpi" href={href}>{body}</a> : <div class="card kpi">{body}</div>
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
    <section class="card section">
      <h3 class="card-label">{title}</h3>
      {children}
    </section>
  )
}

const NAV: Array<[string, string]> = [
  ['Overview', ''],
  ['Chats', 'chats'],
  ['Errors', 'errors'],
  ['Jobs', 'jobs'],
  ['Messages', 'messages'],
]

/** Shared shell: links the Wabot design system, injects the monitor CSS, and
 *  renders the sidebar nav + page body. Light by default; set data-theme="dark"
 *  on .shell for dark mode (tokens swap automatically). */
export function MonitorShell({ active, children }: { active?: string; children: ComponentChildren }) {
  return (
    <div class="shell">
      <link rel="stylesheet" href="https://design.wabot.dev/assets/colors_and_type.css" />
      <style dangerouslySetInnerHTML={{ __html: MONITOR_CSS }} />
      <aside class="sidebar">
        <h6>Monitor</h6>
        <nav>
          <ul>
            {NAV.map(([label, path]) => (
              <li>
                <a href={`/monitor${path ? '/' + path : ''}`} class={active === path ? 'active' : ''}>
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
      <main class="main">{children}</main>
    </div>
  )
}

export function DataTable<T>(props: {
  columns: Array<{ head: string; cell: (row: T) => ComponentChildren }>
  rows: T[]
  empty?: string
}) {
  if (props.rows.length === 0) return <p class="empty">{props.empty ?? 'Sin datos'}</p>
  return (
    <div class="table-scroll">
      <table>
        <thead>
          <tr>{props.columns.map((c) => <th>{c.head}</th>)}</tr>
        </thead>
        <tbody>
          {props.rows.map((row) => (
            <tr>{props.columns.map((c) => <td>{c.cell(row)}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Pager(props: { page: number; totalPages: number; hrefFor: (n: number) => string }) {
  const { page, totalPages } = props
  return (
    <div class="pager">
      {page > 1 ? <a href={props.hrefFor(page - 1)}>Anterior</a> : <span class="muted">Anterior</span>}
      <span>
        Página {page} de {Math.max(1, totalPages)}
      </span>
      {page < totalPages ? <a href={props.hrefFor(page + 1)}>Siguiente</a> : <span class="muted">Siguiente</span>}
    </div>
  )
}

/** Builds a query-string href preserving the given filters, overriding one key. */
export function hrefWith(base: string, query: Record<string, string | undefined>, override: Record<string, string | undefined>): string {
  const merged = { ...query, ...override }
  const qs = Object.entries(merged)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v as string)}`)
    .join('&')
  return qs ? `${base}?${qs}` : base
}
