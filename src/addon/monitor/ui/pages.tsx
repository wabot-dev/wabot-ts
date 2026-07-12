import type {
  ICronRow,
  IErrorRow,
  IJobRow,
  IMessageRow,
  IMonitorDashboard,
} from '../IMonitorStats'
import type { ListErrorsQuery, ListJobsQuery, ListMessagesQuery } from '../QueryDto'
import { BarList, DataTable, hrefWith, KpiCard, MonitorShell, Pager, Section } from './components'
import { fmt, fmtTime, queryRecord } from './format'

export function HubPage({ stats }: { stats: IMonitorDashboard }) {
  const { conversations, messages, errors, jobs, cron, generatedAt } = stats
  return (
    <MonitorShell active="">
      <div class="topbar">
        <h2>Overview</h2>
        <span class="meta">Generado: {new Date(generatedAt).toISOString()}</span>
      </div>
      <div class="kpis">
        <KpiCard label="Conversaciones" value={fmt(conversations.total)} sub={`${fmt(conversations.new24h)} nuevas · 24h`} href="/monitor/chats" />
        <KpiCard label="Mensajes" value={fmt(messages.total)} sub={`${fmt(messages.last24h)} · 24h`} href="/monitor/messages" />
        <KpiCard label="Errores" value={fmt(errors.total)} sub={`${fmt(errors.last24h)} · 24h`} href="/monitor/errors" />
        <KpiCard label="Jobs running" value={fmt(jobs.running)} sub={`${fmt(jobs.failed)} fallidos`} href="/monitor/jobs" />
      </div>
      <div class="grid">
        <Section title="Conversaciones por canal">
          <BarList items={conversations.byChannel} />
        </Section>
        <Section title="Conversaciones por tipo">
          <BarList items={conversations.byType} />
        </Section>
        <Section title="Mensajes por tipo">
          <BarList items={messages.byType} />
        </Section>
        <Section title="Errores por comando">
          <BarList items={errors.byCommand} />
        </Section>
      </div>
      <Section title="Cron jobs">
        <DataTable
          rows={cron}
          empty="Sin cron jobs"
          columns={[
            { head: 'Nombre', cell: (r: ICronRow) => r.name },
            { head: 'Cron', cell: (r: ICronRow) => <span class="mono">{r.cron}</span> },
            {
              head: 'Estado',
              cell: (r: ICronRow) =>
                r.enabled ? <span class="tag tag-ok">on</span> : <span class="tag tag-off">off</span>,
            },
            { head: 'Última', cell: (r: ICronRow) => <span class="mono">{fmtTime(r.lastRunAt)}</span> },
            { head: 'Próxima', cell: (r: ICronRow) => <span class="mono">{fmtTime(r.nextRunAt)}</span> },
          ]}
        />
      </Section>
    </MonitorShell>
  )
}

const stateTag = (state: IJobRow['state']): string =>
  state === 'succeeded' ? 'tag tag-done' : state === 'failed' ? 'tag tag-fail' : state === 'running' ? 'tag tag-run' : 'tag tag-pend'

export function ErrorsPage(props: {
  rows: IErrorRow[]
  total: number
  page: number
  pageSize: number
  query: ListErrorsQuery
}) {
  const { rows, total, page, pageSize, query } = props
  const totalPages = Math.ceil(total / pageSize) || 1
  const q = queryRecord(query as unknown as Record<string, unknown>)
  return (
    <MonitorShell active="errors">
      <div class="topbar">
        <h2>Errores</h2>
        <span class="meta">{total.toLocaleString('en-US')} jobs con error</span>
      </div>
      <DataTable
        rows={rows}
        empty="Sin errores"
        columns={[
          { head: 'Hora', cell: (r: IErrorRow) => <span class="mono">{fmtTime(r.time)}</span> },
          { head: 'Comando', cell: (r: IErrorRow) => <span class="mono">{r.commandName}</span> },
          { head: 'Mensaje', cell: (r: IErrorRow) => <span class="err-msg">{r.message}</span> },
          {
            head: 'Stack',
            cell: (r: IErrorRow) =>
              r.stack ? (
                <details>
                  <summary>ver</summary>
                  <pre class="mono">{r.stack}</pre>
                </details>
              ) : (
                '—'
              ),
          },
        ]}
      />
      <Pager page={page} totalPages={totalPages} hrefFor={(n) => hrefWith('/monitor/errors', q, { page: String(n) })} />
    </MonitorShell>
  )
}

export function JobsPage(props: {
  rows: IJobRow[]
  total: number
  page: number
  pageSize: number
  query: ListJobsQuery
}) {
  const { rows, total, page, pageSize, query } = props
  const totalPages = Math.ceil(total / pageSize) || 1
  const q = queryRecord(query as unknown as Record<string, unknown>)
  const states: Array<{ value: string; label: string }> = [
    { value: '', label: 'todos' },
    { value: 'running', label: 'running' },
    { value: 'pending', label: 'pending' },
    { value: 'succeeded', label: 'succeeded' },
    { value: 'failed', label: 'failed' },
  ]
  return (
    <MonitorShell active="jobs">
      <div class="topbar">
        <h2>Jobs</h2>
        <span class="meta">{total.toLocaleString('en-US')} jobs</span>
      </div>
      <form class="filters" method="get" action="/monitor/jobs">
        <label>
          Estado
          <select name="state">
            {states.map((s) => (
              <option value={s.value} selected={query.state === s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <button>Filtrar</button>
      </form>
      <DataTable
        rows={rows}
        empty="Sin jobs"
        columns={[
          { head: 'ID', cell: (r: IJobRow) => <span class="mono">{r.id}</span> },
          { head: 'Comando', cell: (r: IJobRow) => <span class="mono">{r.commandName}</span> },
          { head: 'Estado', cell: (r: IJobRow) => <span class={stateTag(r.state)}>{r.state}</span> },
          { head: 'Iniciado', cell: (r: IJobRow) => <span class="mono">{fmtTime(r.startedAt)}</span> },
          { head: 'Error', cell: (r: IJobRow) => r.errorMessage ?? '—' },
        ]}
      />
      <Pager page={page} totalPages={totalPages} hrefFor={(n) => hrefWith('/monitor/jobs', q, { page: String(n) })} />
    </MonitorShell>
  )
}

export function MessagesPage(props: {
  rows: IMessageRow[]
  total: number
  page: number
  pageSize: number
  query: ListMessagesQuery
}) {
  const { rows, total, page, pageSize, query } = props
  const totalPages = Math.ceil(total / pageSize) || 1
  const q = queryRecord(query as unknown as Record<string, unknown>)
  const types: Array<{ value: string; label: string }> = [
    { value: '', label: 'todos' },
    { value: 'humanMessage', label: 'human' },
    { value: 'botMessage', label: 'bot' },
    { value: 'functionCall', label: 'function' },
  ]
  return (
    <MonitorShell active="messages">
      <div class="topbar">
        <h2>Mensajes</h2>
        <span class="meta">{total.toLocaleString('en-US')} mensajes</span>
      </div>
      <form class="filters" method="get" action="/monitor/messages">
        <label>
          Tipo
          <select name="type">
            {types.map((t) => (
              <option value={t.value} selected={query.type === t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <button>Filtrar</button>
      </form>
      <DataTable
        rows={rows}
        empty="Sin mensajes"
        columns={[
          { head: 'Hora', cell: (r: IMessageRow) => <span class="mono">{fmtTime(r.createdAt)}</span> },
          {
            head: 'Chat',
            cell: (r: IMessageRow) => (
              <a class="mono" href={`/monitor/chats/${encodeURIComponent(r.chatId)}`}>
                {r.chatId}
              </a>
            ),
          },
          { head: 'Tipo', cell: (r: IMessageRow) => r.type },
          { head: 'Texto', cell: (r: IMessageRow) => r.text ?? '—' },
        ]}
      />
      <Pager page={page} totalPages={totalPages} hrefFor={(n) => hrefWith('/monitor/messages', q, { page: String(n) })} />
    </MonitorShell>
  )
}
