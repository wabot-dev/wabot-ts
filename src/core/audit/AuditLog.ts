import { generate as generateShortUuid } from 'short-uuid'

import { getLogContext } from '@/core/logger'
import { getAuditActor, getAuditSource } from './auditContext'
import { IAuditActor } from './IAuditActor'

/** What the caller supplies to `record`. Actor / source / requestId default from context. */
export interface IAuditEventInput {
  /** The stream (→ its own append-only table `audit_<stream>`). */
  stream: string
  /** What happened: `created` / `updated` / `destroyed`, or a domain action. */
  action: string
  /** The resource acted on (entity id, …). */
  target?: string
  /** Overrides the ambient actor for this entry. */
  actor?: IAuditActor
  /** Overrides the ambient provenance for this entry. */
  source?: string
  /** Snapshot / before→after / arbitrary context. */
  data?: Record<string, unknown>
}

/** A stored audit entry. */
export interface IAuditEntry {
  id: string
  createdAt: number
  stream: string
  action: string
  target?: string
  actor: IAuditActor
  requestId?: string
  source?: string
  data?: Record<string, unknown>
}

/** Filter for reading a stream back (investigations, recovery). */
export interface IAuditQuery {
  stream: string
  target?: string
  action?: string
  actorId?: string
  from?: number
  to?: number
  limit?: number
}

/**
 * Append-only audit log. Each **stream** is stored separately (its own table),
 * so volume shards by domain and stays queryable at millions of rows. Two
 * implementations are selected by the project runner from `DATABASE_URL`: an
 * in-memory one (dev/tests) and a Postgres one.
 *
 * `record` stamps the actor, provenance and correlation id from the current
 * context, so callers only say *what* happened. There is no update or delete —
 * it is the durable record of destroyed/changed objects (a replacement for
 * soft-deletion).
 */
export class AuditLog {
  async record(event: IAuditEventInput): Promise<void> {
    await this.append({
      id: generateShortUuid(),
      createdAt: Date.now(),
      stream: event.stream,
      action: event.action,
      target: event.target,
      actor: event.actor ?? getAuditActor() ?? { type: 'system' },
      requestId: getLogContext()?.requestId,
      source: event.source ?? getAuditSource(),
      data: event.data,
    })
  }

  /** Read a stream back, newest first. */
  query(_query: IAuditQuery): Promise<IAuditEntry[]> {
    throw new Error('Not implemented')
  }

  /** Persist one entry. Implemented by each backend. */
  protected append(_entry: IAuditEntry): Promise<void> {
    throw new Error('Not implemented')
  }
}
