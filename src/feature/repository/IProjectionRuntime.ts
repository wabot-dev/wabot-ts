import { IConstructor } from '@/core/generics'

/**
 * What a backend must provide for a projection to run its own statements. Only
 * backends that speak a query language implement it; the ones that don't — the
 * in-memory backend — are the reason a projection also needs a `@memExtension`.
 */
export interface IProjectionRuntime {
  /**
   * Run a statement and turn each row into an instance of `row`, coerced to the
   * types its validators declare and validated. Takes part in an open
   * transaction on the same database.
   */
  query<T>(row: IConstructor<T>, sql: string, params?: unknown[]): Promise<T[]>
}
