import { Pool } from 'pg'

import { Entity, IEntityData } from '@/core/entity'
import {
  IQueryAst,
  IRepositoryAdapter,
  IRepositoryConfig,
  IRepositoryRuntime,
} from '@/feature/repository'
import { IPgRepositoryConfig } from './IPgRepositoryConfig'
import { PgCrudRepository } from './PgCrudRepository'
import { buildQuerySql } from './buildQuerySql'
import { withPgClient } from './withPgClient'

class PgJsonRepositoryRuntime<P extends Entity<IEntityData>>
  extends PgCrudRepository<P>
  implements IRepositoryRuntime<P>
{
  async runQuery(ast: IQueryAst, args: unknown[]): Promise<P[]> {
    const built = buildQuerySql(ast, this.table, this.columns)
    const params = built.buildParams(args)
    return this.query(built.sql, params)
  }

  async runCount(ast: IQueryAst, args: unknown[]): Promise<number> {
    const built = buildQuerySql(ast, this.table, this.columns)
    const params = built.buildParams(args)
    return withPgClient(this.pool, async (client) => {
      await this.ensureTable(client)
      const result = await client.query(built.sql, params)
      return result.rows[0]?.count ?? 0
    })
  }

  async runExists(ast: IQueryAst, args: unknown[]): Promise<boolean> {
    const built = buildQuerySql(ast, this.table, this.columns)
    const params = built.buildParams(args)
    return withPgClient(this.pool, async (client) => {
      await this.ensureTable(client)
      const result = await client.query(built.sql, params)
      return Boolean(result.rows[0]?.exists)
    })
  }

  async runDelete(ast: IQueryAst, args: unknown[]): Promise<void> {
    const built = buildQuerySql(ast, this.table, this.columns)
    const params = built.buildParams(args)
    await this.exec(built.sql, params)
  }
}

export class PgJsonRepositoryAdapter implements IRepositoryAdapter {
  constructor(private readonly pool: Pool) {}

  build<P extends Entity<IEntityData>>(config: IRepositoryConfig<P>): IRepositoryRuntime<P> {
    return new PgJsonRepositoryRuntime<P>(this.pool, config as unknown as IPgRepositoryConfig<P>)
  }
}
