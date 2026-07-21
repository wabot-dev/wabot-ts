import { IConstructor } from '@/core/generics'
import { IDbPoolProvider } from './IDbPoolProvider'
import { IRepositoryAuditEvent, IRepositoryConfig } from './IRepositoryConfig'

export interface INormalizedAudit {
  events: Set<IRepositoryAuditEvent>
  stream: string
  /** Audit pool provider; defaults to the repository's own data pool. */
  pool?: IConstructor<IDbPoolProvider>
}

/** Resolve a repository's `audit` config to a normalized shape, or undefined when off. */
export function normalizeAudit(config: IRepositoryConfig<any>): INormalizedAudit | undefined {
  if (!config.audit) return undefined
  const audit = config.audit === true ? {} : config.audit
  return {
    events: new Set(audit.events ?? ['create', 'update', 'destroy']),
    stream: audit.stream ?? config.table,
    pool: audit.pool ?? config.pool,
  }
}
