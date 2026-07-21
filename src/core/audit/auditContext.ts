import { addLogContext, getLogContext } from '@/core/logger'
import { IAuditActor } from './IAuditActor'

const ACTOR_KEY = 'auditActor'
const SOURCE_KEY = 'auditSource'

// The audit actor/source ride the existing log context (AsyncLocalStorage), so
// they flow automatically through a request/job and correlate with logs — no
// second propagation mechanism. Entry points (guards, the async runner, chat)
// set them; AuditLog.record reads them.

/** Set the actor for the current async scope (guard on auth, cron/command runner…). */
export function setAuditActor(actor: IAuditActor): void {
  addLogContext({ [ACTOR_KEY]: actor })
}

/** The actor active in the current scope, if any. */
export function getAuditActor(): IAuditActor | undefined {
  return getLogContext()?.[ACTOR_KEY] as IAuditActor | undefined
}

/** Set the provenance for the current scope (e.g. `command:orders.charge`). */
export function setAuditSource(source: string): void {
  addLogContext({ [SOURCE_KEY]: source })
}

/** The provenance active in the current scope, if any. */
export function getAuditSource(): string | undefined {
  return getLogContext()?.[SOURCE_KEY] as string | undefined
}
