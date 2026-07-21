/**
 * Who or what caused an audited change. A command is never the actor — it
 * inherits the actor that dispatched it (see the async runner) and records the
 * command as `source` on the entry.
 */
export interface IAuditActor {
  type: 'user' | 'cron' | 'system' | (string & {})
  /** Stable id (user id, cron/command name). Absent for an anonymous user without a resolver. */
  id?: string
  label?: string
  /** Extra context (auth claims, channel, ip…). Kept `any`-valued so it can ride a stored Job. */
  data?: Record<string, any>
}
