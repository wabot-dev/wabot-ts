import { Entity, IEntityData } from '@/core/entity'
import { container, singleton } from '@/core/injection'
import { IConstructor } from '@/core/generics'
import { IPgRepositoryConfig } from '../IPgRepositoryConfig'
import { withPgClient } from '../withPgClient'
import { buildQuerySql, IBuiltQuery } from './buildQuerySql'
import { parseQueryMethodName } from './parseQueryMethodName'
import { PgJsonRepository } from './PgJsonRepository'
import { PgRepositoryMetadataStore } from './PgRepositoryMetadataStore'
import { IQueryAst } from './types'

const QUERY_CACHE_KEY = Symbol('wabot:pgQueryCache')

function makeQueryImpl(methodName: string, ast: IQueryAst) {
  return async function (this: any, ...args: any[]): Promise<any> {
    let cache: Map<string, IBuiltQuery> | undefined = this[QUERY_CACHE_KEY]
    if (!cache) {
      cache = new Map()
      Object.defineProperty(this, QUERY_CACHE_KEY, { value: cache, enumerable: false })
    }

    let built = cache.get(methodName)
    if (!built) {
      built = buildQuerySql(ast, this.table, this.columns)
      cache.set(methodName, built)
    }
    const params = built.buildParams(args)

    switch (ast.prefix) {
      case 'find': {
        return await this.query(built.sql, params)
      }
      case 'findOne': {
        const items = await this.query(built.sql, params)
        return items[0] ?? null
      }
      case 'count': {
        return await withPgClient(this.pool, async (client) => {
          await this.ensureTable(client)
          const result = await client.query(built!.sql, params)
          return result.rows[0]?.count ?? 0
        })
      }
      case 'exists': {
        return await withPgClient(this.pool, async (client) => {
          await this.ensureTable(client)
          const result = await client.query(built!.sql, params)
          return Boolean(result.rows[0]?.exists)
        })
      }
      case 'delete': {
        await this.exec(built.sql, params)
        return
      }
    }
  }
}

export function pgJsonRepository<P extends Entity<IEntityData>>(
  config: IPgRepositoryConfig<P>,
) {
  return function (target: IConstructor<any>) {
    if (target !== PgJsonRepository && !(target.prototype instanceof PgJsonRepository)) {
      throw new Error(
        `@pgJsonRepository: ${target.name} must extend PgJsonRepository`,
      )
    }

    const store = container.resolve(PgRepositoryMetadataStore)
    store.saveRepositoryConfig(target, config)

    const queryMethods = store.getQueryMethods(target)
    for (const meta of queryMethods) {
      if (Object.prototype.hasOwnProperty.call(target.prototype, meta.functionName)) {
        const existing = target.prototype[meta.functionName]
        if (typeof existing === 'function') {
          continue
        }
      }
      const ast = parseQueryMethodName(meta.functionName)
      target.prototype[meta.functionName] = makeQueryImpl(meta.functionName, ast)
    }

    singleton()(target)
  }
}
