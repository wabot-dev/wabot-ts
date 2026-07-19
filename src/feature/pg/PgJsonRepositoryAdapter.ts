import { Pool } from 'pg'

import { Entity, IEntityData } from '@/core/entity'
import { IConstructor } from '@/core/generics'
import {
  DB_EXTENSION_ID,
  IQueryAst,
  IRepositoryAdapter,
  IRepositoryConfig,
  IRepositoryRuntime,
} from '@/feature/repository'
import { IPgRepositoryConfig } from './IPgRepositoryConfig'
import { PgCrudRepository } from './PgCrudRepository'
import { PgSqlRepositoryBase } from './PgSqlRepositoryBase'
import { buildQuerySql } from './buildQuerySql'
import { withPgClient } from './withPgClient'

function inheritsFrom(ctor: Function, base: Function): boolean {
  let proto: any = ctor.prototype
  while (proto) {
    if (proto === base.prototype) return true
    proto = Object.getPrototypeOf(proto)
  }
  return false
}

class PgJsonRepositoryRuntime<P extends Entity<IEntityData>>
  extends PgCrudRepository<P>
  implements IRepositoryRuntime<P>
{
  async runQuery(ast: IQueryAst, args: unknown[]): Promise<P[]> {
    const built = buildQuerySql(ast, this.table, this.columns, Object.keys(this.addColumns))
    const params = built.buildParams(args)
    return this.query(built.sql, params)
  }

  async runCount(ast: IQueryAst, args: unknown[]): Promise<number> {
    const built = buildQuerySql(ast, this.table, this.columns, Object.keys(this.addColumns))
    const params = built.buildParams(args)
    return withPgClient(this.pool, async (client) => {
      await this.ensureTable(client)
      const result = await client.query(built.sql, params)
      return result.rows[0]?.count ?? 0
    })
  }

  async runExists(ast: IQueryAst, args: unknown[]): Promise<boolean> {
    const built = buildQuerySql(ast, this.table, this.columns, Object.keys(this.addColumns))
    const params = built.buildParams(args)
    return withPgClient(this.pool, async (client) => {
      await this.ensureTable(client)
      const result = await client.query(built.sql, params)
      return Boolean(result.rows[0]?.exists)
    })
  }

  async runDelete(ast: IQueryAst, args: unknown[]): Promise<void> {
    const built = buildQuerySql(ast, this.table, this.columns, Object.keys(this.addColumns))
    const params = built.buildParams(args)
    await this.exec(built.sql, params)
  }
}

/**
 * The Postgres backend. Supports two storage strategies, chosen per repository
 * by the base class its `@dbExtension` extends: `PgSqlRepositoryExtension` →
 * relational (real columns), anything else (including no extension) → JSONB.
 */
export class PgRepositoryAdapter implements IRepositoryAdapter {
  readonly id = DB_EXTENSION_ID

  constructor(private readonly pool: Pool) {}

  build<P extends Entity<IEntityData>>(
    config: IRepositoryConfig<P>,
    extensionCtor?: IConstructor<any>,
  ): IRepositoryRuntime<P> {
    const pgConfig = config as unknown as IPgRepositoryConfig<P>
    if (extensionCtor && inheritsFrom(extensionCtor, PgSqlRepositoryBase)) {
      return new PgSqlRepositoryBase<P>(this.pool, pgConfig)
    }
    return new PgJsonRepositoryRuntime<P>(this.pool, pgConfig)
  }

  buildExtension<E>(config: IRepositoryConfig<any>, ExtensionCtor: IConstructor<E>): E {
    return new ExtensionCtor(this.pool, config as unknown as IPgRepositoryConfig<any>)
  }
}

/** @deprecated Use `PgRepositoryAdapter` (the pg backend now serves both strategies). */
export { PgRepositoryAdapter as PgJsonRepositoryAdapter }
