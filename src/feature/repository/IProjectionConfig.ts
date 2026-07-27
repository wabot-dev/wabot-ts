import { IConstructor } from '@/core/generics'
import { IDbPoolProvider } from './IDbPoolProvider'

/**
 * Everything a projection declares. A projection owns its SQL — joins,
 * aggregates, whatever the question needs — so there is no table, no schema and
 * no entity to configure. The only choice left is which database answers it.
 */
export interface IProjectionConfig {
  /**
   * Which database this projection reads, selected by its `@dbPool` provider
   * class. Omit to use the default database (`DATABASE_URL`) — typically set to
   * route heavy reads at a replica.
   *
   * Note that a projection pointed at a replica cannot take part in a
   * transaction opened against the primary: different pool, different
   * connection, so it will not see uncommitted writes.
   */
  pool?: IConstructor<IDbPoolProvider>
}
