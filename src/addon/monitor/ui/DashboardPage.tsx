import type { IMonitorDashboard } from '../IMonitorStats'
import { BarList, KpiCard, Section } from './components'

const CSS = `
  :root { color-scheme: light dark; }
  body { margin: 0; font: 14px/1.5 system-ui, -apple-system, Segoe UI, sans-serif; background: #0f1115; color: #e6e6e6; }
  .wrap { max-width: 980px; margin: 0 auto; padding: 24px 16px 64px; }
  header h1 { margin: 0 0 4px; font-size: 20px; }
  header .meta { color: #8a8f98; font-size: 12px; margin-bottom: 20px; }
  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
  .kpi { background: #171a21; border: 1px solid #232733; border-radius: 10px; padding: 14px; }
  .kpi-value { font-size: 26px; font-weight: 700; }
  .kpi-label { color: #9aa0aa; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
  .kpi-sub { color: #6f7480; font-size: 11px; margin-top: 2px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px; }
  @media (max-width: 720px) { .grid { grid-template-columns: 1fr; } }
  .section { background: #171a21; border: 1px solid #232733; border-radius: 10px; padding: 16px; margin-bottom: 20px; }
  .section h2 { margin: 0 0 12px; font-size: 13px; text-transform: uppercase; letter-spacing: .05em; color: #c8ccd4; }
  .empty { color: #6f7480; margin: 0; }
  ul.bars { list-style: none; margin: 0; padding: 0; }
  ul.bars li { display: grid; grid-template-columns: 120px 1fr 64px; align-items: center; gap: 8px; margin-bottom: 6px; }
  .bar-label { font-size: 12px; color: #c8ccd4; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bar-track { background: #232733; border-radius: 4px; height: 10px; overflow: hidden; }
  .bar-fill { display: block; height: 100%; background: #4c8dff; }
  .bar-count { text-align: right; font-variant-numeric: tabular-nums; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #232733; vertical-align: top; }
  th { color: #9aa0aa; font-weight: 600; }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  .err-msg { color: #ffb4b4; }
  .tag { display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 11px; }
  .tag-ok { background: #1e3a23; color: #7ee29c; }
  .tag-off { background: #3a1e1e; color: #e29c9c; }
`

function fmt(n: number): string {
  return n.toLocaleString('en-US')
}

function fmtTime(ms: number | null): string {
  return ms ? new Date(ms).toISOString().replace('T', ' ').slice(0, 19) + ' UTC' : '—'
}

export function DashboardPage({ stats }: { stats: IMonitorDashboard }) {
  const { conversations, messages, errors, jobs, cron, generatedAt } = stats

  return (
    <div class="wrap">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <header>
        <h1>Wabot Monitor</h1>
        <div class="meta">Generado: {new Date(generatedAt).toISOString()}</div>
      </header>

      <div class="kpis" style="margin-bottom:20px">
        <KpiCard
          label="Conversaciones"
          value={fmt(conversations.total)}
          sub={`${fmt(conversations.new24h)} nuevas · 24h`}
        />
        <KpiCard
          label="Mensajes"
          value={fmt(messages.total)}
          sub={`${fmt(messages.last24h)} · 24h`}
        />
        <KpiCard
          label="Errores"
          value={fmt(errors.total)}
          sub={`${fmt(errors.last24h)} · 24h`}
        />
        <KpiCard
          label="Jobs running"
          value={fmt(jobs.running)}
          sub={`${fmt(jobs.failed)} fallidos`}
        />
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

      <Section title="Jobs asíncronos">
        <div class="kpis">
          <KpiCard label="Running" value={fmt(jobs.running)} />
          <KpiCard label="Pendientes" value={fmt(jobs.pending)} />
          <KpiCard label="Exitosos" value={fmt(jobs.succeeded)} />
          <KpiCard label="Fallidos" value={fmt(jobs.failed)} />
        </div>
      </Section>

      <Section title="Errores recientes">
        {errors.recent.length === 0 ? (
          <p class="empty">Sin errores registrados</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Hora</th>
                <th>Comando</th>
                <th>Mensaje</th>
              </tr>
            </thead>
            <tbody>
              {errors.recent.map((e) => (
                <tr>
                  <td class="mono">{fmtTime(e.time)}</td>
                  <td class="mono">{e.commandName}</td>
                  <td class="err-msg">{e.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Cron jobs">
        {cron.length === 0 ? (
          <p class="empty">Sin cron jobs</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Cron</th>
                <th>Estado</th>
                <th>Última</th>
                <th>Próxima</th>
              </tr>
            </thead>
            <tbody>
              {cron.map((c) => (
                <tr>
                  <td>{c.name}</td>
                  <td class="mono">{c.cron}</td>
                  <td>
                    {c.enabled ? (
                      <span class="tag tag-ok">on</span>
                    ) : (
                      <span class="tag tag-off">off</span>
                    )}
                  </td>
                  <td class="mono">{fmtTime(c.lastRunAt)}</td>
                  <td class="mono">{fmtTime(c.nextRunAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </div>
  )
}
