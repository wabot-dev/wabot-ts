import { singleton } from '@/core/injection'
import { AuditLog, IAuditEntry, IAuditQuery } from '@/core/audit'

/**
 * In-memory audit log (dev / tests / no database). Keeps entries per stream in
 * RAM. Append-only like the Postgres backend; nothing is persisted across
 * restarts.
 */
@singleton()
export class InMemoryAuditLog extends AuditLog {
  private streams = new Map<string, IAuditEntry[]>()

  protected async append(entry: IAuditEntry): Promise<void> {
    const list = this.streams.get(entry.stream)
    if (list) list.push(entry)
    else this.streams.set(entry.stream, [entry])
  }

  async query(query: IAuditQuery): Promise<IAuditEntry[]> {
    let entries = [...(this.streams.get(query.stream) ?? [])]
    if (query.target !== undefined) entries = entries.filter((e) => e.target === query.target)
    if (query.action !== undefined) entries = entries.filter((e) => e.action === query.action)
    if (query.actorId !== undefined) entries = entries.filter((e) => e.actor.id === query.actorId)
    if (query.from !== undefined) entries = entries.filter((e) => e.createdAt >= query.from!)
    if (query.to !== undefined) entries = entries.filter((e) => e.createdAt <= query.to!)
    // Newest first, tie-broken by id — matches the Postgres backend.
    entries.sort((a, b) => b.createdAt - a.createdAt || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0))
    return query.limit !== undefined ? entries.slice(0, query.limit) : entries
  }
}
