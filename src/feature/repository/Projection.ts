import { IConstructor } from '@/core/generics'

/**
 * Base for a projection: a read-only object built by its own statements —
 * joins, aggregates, anything the question needs — rather than mapped to a
 * table. Extend it and write the SQL in the methods themselves; the class *is*
 * the database implementation, so there is no separate extension for it.
 *
 * ```typescript
 * @projection()
 * export class CustomerRevenue {
 *   async topSpenders(limit: number): Promise<CustomerRevenueRow[]> {
 *     return this.query(CustomerRevenueRow, `SELECT … JOIN … GROUP BY …`, [limit])
 *   }
 * }
 * ```
 *
 * What the framework adds over holding a connection yourself: the database is
 * resolved the same way a repository's is (`@projection({ pool })`), the
 * statements join whatever transaction is open on it, and rows come back as
 * instances of the declared class, coerced and validated.
 *
 * A backend that cannot run statements — the in-memory one — serves the
 * projection through the `@memExtension` registered for it instead, so a
 * projection without one fails at startup rather than at the first call.
 */
export abstract class Projection {
  /** Run a statement, one instance of `row` per result row. */
  protected query<T>(row: IConstructor<T>, sql: string, params: unknown[] = []): Promise<T[]> {
    return projectionRuntimeOf(this).query(row, sql, params)
  }

  /** Same, for a statement that answers with at most one row. */
  protected async queryOne<T>(
    row: IConstructor<T>,
    sql: string,
    params: unknown[] = [],
  ): Promise<T | null> {
    const rows = await this.query(row, sql, params)
    return rows.at(0) ?? null
  }
}

/**
 * Set by `@projection` when it installs the dispatch, so the base can reach the
 * backend without every projection having to take it in its constructor.
 */
export const PROJECTION_RUNTIME = Symbol('wabot:projectionRuntime')

function projectionRuntimeOf(self: any) {
  const runtime = self[PROJECTION_RUNTIME]
  if (!runtime) {
    throw new Error(
      `${self.constructor?.name ?? 'Projection'}: no projection runtime available. ` +
        `Decorate the class with @projection() so the framework can resolve its database.`,
    )
  }
  return runtime
}
