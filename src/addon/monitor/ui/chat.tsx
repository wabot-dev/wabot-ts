import type { IChatSummary, IChatThreadItem } from '../IChatsBrowser'
import type { ListChatsQuery } from '../QueryDto'
import { MonitorShell, DataTable, Pager, hrefWith } from './components'
import { fmtTime, prettyJson, queryRecord } from './format'

/** One chat_item rendered as a message bubble or a collapsible function call. */
export function MessageBubble({ item }: { item: IChatThreadItem }) {
  if (item.type === 'functionCall') {
    return <FunctionCallBlock item={item} />
  }
  const isHuman = item.type === 'humanMessage'
  const msg = item.data?.humanMessage ?? item.data?.botMessage ?? {}
  return (
    <div class={`bubble ${isHuman ? 'human' : 'bot'}`}>
      <div class="who">
        {isHuman ? msg.senderName ?? 'usuario' : 'bot'} · {fmtTime(item.createdAt)}
      </div>
      <div class="text">{msg.text ?? '(sin texto)'}</div>
    </div>
  )
}

function FunctionCallBlock({ item }: { item: IChatThreadItem }) {
  const fc = item.data?.functionCall
  if (!fc) return null
  const args = prettyJson(fc.arguments)
  const result = prettyJson(fc.result)
  return (
    <details class="fcall">
      <summary>
        fn {fc.name} · {fmtTime(item.createdAt)}
      </summary>
      {args != null ? (
        <>
          <div class="label">arguments</div>
          <pre>{args}</pre>
        </>
      ) : null}
      {result != null ? (
        <>
          <div class="label">result</div>
          <pre>{result}</pre>
        </>
      ) : null}
    </details>
  )
}

export function ChatListPage(props: {
  rows: IChatSummary[]
  total: number
  page: number
  pageSize: number
  query: ListChatsQuery
}) {
  const { rows, total, page, pageSize, query } = props
  const totalPages = Math.ceil(total / pageSize) || 1
  const q = queryRecord(query as unknown as Record<string, unknown>)
  return (
    <MonitorShell active="chats">
      <div class="topbar">
        <h2>Chats</h2>
        <span class="meta">{total.toLocaleString('en-US')} conversaciones</span>
      </div>
      <form class="filters" method="get" action="/monitor/chats">
        <label>
          Canal
          <input name="channel" value={query.channel ?? ''} />
        </label>
        <label>
          Tipo
          <select name="type">
            <option value="" selected={!query.type}>
              todos
            </option>
            <option value="PRIVATE" selected={query.type === 'PRIVATE'}>
              PRIVATE
            </option>
            <option value="GROUP" selected={query.type === 'GROUP'}>
              GROUP
            </option>
          </select>
        </label>
        <label>
          Buscar ID
          <input name="q" value={query.q ?? ''} />
        </label>
        <button>Filtrar</button>
      </form>
      <DataTable
        rows={rows}
        empty="Sin conversaciones"
        columns={[
          { head: 'ID', cell: (r) => <a class="mono" href={`/monitor/chats/${encodeURIComponent(r.id)}`}>{r.id}</a> },
          { head: 'Canales', cell: (r) => r.channels.join(', ') || '—' },
          { head: 'Tipo', cell: (r) => r.type },
          { head: 'Mensajes', cell: (r) => r.msgCount },
          { head: 'Última actividad', cell: (r) => fmtTime(r.lastActivity) },
        ]}
      />
      <Pager page={page} totalPages={totalPages} hrefFor={(n) => hrefWith('/monitor/chats', q, { page: String(n) })} />
    </MonitorShell>
  )
}

export function ChatDetailPage(props: { header: IChatSummary | null; items: IChatThreadItem[] }) {
  const { header, items } = props
  return (
    <MonitorShell active="chats">
      <div class="topbar">
        <h2 class="mono">{header?.id ?? 'Chat'}</h2>
        <span class="meta">
          {header ? `${header.channels.join(', ') || '—'} · ${header.type} · ${header.msgCount} mensajes` : ''}
        </span>
      </div>
      {header == null ? (
        <p class="empty">Chat no encontrado</p>
      ) : items.length === 0 ? (
        <p class="empty">Sin mensajes</p>
      ) : (
        <div class="thread">{items.map((it) => <MessageBubble item={it} />)}</div>
      )}
    </MonitorShell>
  )
}
