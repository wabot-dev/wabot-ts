import { Pool } from 'pg'

import { Entity, IEntityData } from '@/core/entity'
import { IConstructor } from '@/core/generics'
import {
  DB_EXTENSION_ID,
  IPage,
  IPageOptions,
  IQueryAst,
  IQueryCondition,
  IRepositoryAdapter,
  IProjectionRuntime,
  IRepositoryConfig,
  IRepositoryRuntime,
  buildPage,
  decodeCursor,
} from '@/feature/repository'
import { describeStorage, IStorageDeclaration, storageOf } from '@/core/repository'
import { IPgRepositoryConfig } from './IPgRepositoryConfig'
import { PG_ENGINE } from './pgEngine'
import { PgProjectionRuntime } from './PgProjectionRuntime'
import { PgCrudRepository } from './PgCrudRepository'
import { PgSqlRepositoryBase } from './PgSqlRepositoryBase'
import { buildQuerySql } from './buildQuerySql'
import { buildPageSql } from './pgPageSql'
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

  async runPage(
    conditions: IQueryCondition[],
    args: unknown[],
    options: IPageOptions,
  ): Promise<IPage<P>> {
    const cursor = options.cursor ? decodeCursor(options.cursor) : undefined
    const built = buildPageSql(this.table, this.columns, conditions, Object.keys(this.addColumns), {
      cursorCreatedAt: cursor ? new Date(cursor.createdAt) : undefined,
      cursorId: cursor?.id,
      limit: options.limit,
    })
    const rows = await this.query(built.sql, built.buildParams(args))
    return buildPage(rows, Math.max(1, Math.floor(options.limit)))
  }
}

/**
 * The Postgres backend. Serves two storage strategies, chosen per repository by
 * the base class it extends: `PgColumnsRepository` → real columns,
 * `PgJsonbRepository` → JSONB. A repository that declares nothing (plain
 * `CrudRepository`) gets JSONB, which is what it has always got.
 */
export class PgRepositoryAdapter implements IRepositoryAdapter {
  readonly id = DB_EXTENSION_ID

  constructor(private readonly pool: Pool) {}

  build<P extends Entity<IEntityData>>(
    config: IRepositoryConfig<P>,
    extensionCtor?: IConstructor<any>,
    storage?: IStorageDeclaration,
  ): IRepositoryRuntime<P> {
    const pgConfig = config as unknown as IPgRepositoryConfig<P>
    if (this.usesColumns(config, storage, extensionCtor)) {
      return new PgSqlRepositoryBase<P>(this.pool, pgConfig)
    }
    return new PgJsonRepositoryRuntime<P>(this.pool, pgConfig)
  }

  buildExtension<E>(config: IRepositoryConfig<any>, ExtensionCtor: IConstructor<E>): E {
    const declared = storageOf(ExtensionCtor)
    if (declared && declared.engine !== PG_ENGINE) {
      throw new Error(
        `${ExtensionCtor.name} is an extension for ${describeStorage(declared)}, but the ` +
          `active backend is Postgres. Extend PgJsonbRepositoryExtension or ` +
          `PgColumnsRepositoryExtension.`,
      )
    }
    return new ExtensionCtor(this.pool, config as unknown as IPgRepositoryConfig<any>)
  }

  /** Projections run their own SQL on this backend's pool. */
  buildProjection(): IProjectionRuntime {
    return new PgProjectionRuntime(this.pool)
  }

  private usesColumns(
    config: IRepositoryConfig<any>,
    storage: IStorageDeclaration | undefined,
    extensionCtor?: IConstructor<any>,
  ): boolean {
    if (storage) {
      if (storage.engine !== PG_ENGINE) {
        throw new Error(
          `${config.table}: the repository declares ${describeStorage(storage)} storage, but the ` +
            `active backend is Postgres. Extend PgJsonbRepository or PgColumnsRepository.`,
        )
      }
      return storage.strategy === 'columns'
    }
    // Nothing declared on the repository: fall back to the extension's base.
    return Boolean(extensionCtor && inheritsFrom(extensionCtor, PgSqlRepositoryBase))
  }
}

/** @deprecated Use `PgRepositoryAdapter` (the pg backend now serves both strategies). */
export { PgRepositoryAdapter as PgJsonRepositoryAdapter }
