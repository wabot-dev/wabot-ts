import { Entity, IEntityData } from '@/core/entity'
import { container, singleton } from '@/core/injection'
import { IConstructor } from '@/core/generics'
import { IQueryAst } from './types'
import { IRepositoryConfig } from './IRepositoryConfig'
import { IRepositoryRuntime } from './IRepositoryRuntime'
import { parseQueryMethodName } from './parseQueryMethodName'
import { RepositoryAdapterRegistry } from './RepositoryAdapterRegistry'
import { RepositoryMetadataStore } from './RepositoryMetadataStore'

const RUNTIME_KEY = Symbol('wabot:repositoryRuntime')
const AST_CACHE_KEY = Symbol('wabot:repositoryAstCache')

function getRuntime<P extends Entity<IEntityData>>(self: any): IRepositoryRuntime<P> {
  let runtime: IRepositoryRuntime<P> | undefined = self[RUNTIME_KEY]
  if (runtime) return runtime

  const ctor = self.constructor as IConstructor<any>
  const store = container.resolve(RepositoryMetadataStore)
  const config = store.getRepositoryConfig(ctor)
  if (!config) {
    throw new Error(`${ctor.name} must be decorated with @repository`)
  }
  const adapter = container.resolve(RepositoryAdapterRegistry).getDefault()
  runtime = adapter.build(config) as IRepositoryRuntime<P>
  Object.defineProperty(self, RUNTIME_KEY, { value: runtime, enumerable: false })
  return runtime
}

function getAst(self: any, methodName: string): IQueryAst {
  let cache: Map<string, IQueryAst> | undefined = self[AST_CACHE_KEY]
  if (!cache) {
    cache = new Map()
    Object.defineProperty(self, AST_CACHE_KEY, { value: cache, enumerable: false })
  }
  let ast = cache.get(methodName)
  if (!ast) {
    ast = parseQueryMethodName(methodName)
    cache.set(methodName, ast)
  }
  return ast
}

function makeQueryImpl(methodName: string) {
  return async function (this: any, ...args: unknown[]): Promise<unknown> {
    const ast = getAst(this, methodName)
    const runtime = getRuntime(this)
    switch (ast.prefix) {
      case 'find':
        return runtime.runQuery(ast, args)
      case 'findOne': {
        const rows = await runtime.runQuery(ast, args)
        return rows[0] ?? null
      }
      case 'count':
        return runtime.runCount(ast, args)
      case 'exists':
        return runtime.runExists(ast, args)
      case 'delete':
        return runtime.runDelete(ast, args)
    }
  }
}

const CRUD_METHODS = {
  async find(this: any, id: string) {
    return getRuntime(this).find(id)
  },
  async findOrThrow(this: any, id: string) {
    return getRuntime(this).findOrThrow(id)
  },
  async findByIds(this: any, ids: string[]) {
    return getRuntime(this).findByIds(ids)
  },
  async findAll(this: any) {
    return getRuntime(this).findAll()
  },
  async create(this: any, item: any) {
    return getRuntime(this).create(item)
  },
  async update(this: any, item: any) {
    return getRuntime(this).update(item)
  },
  async delete(this: any, item: any) {
    return getRuntime(this).delete(item)
  },
}

function installCrudMethods(target: IConstructor<any>) {
  const proto = target.prototype
  for (const [name, fn] of Object.entries(CRUD_METHODS)) {
    if (Object.prototype.hasOwnProperty.call(proto, name)) {
      const existing = proto[name]
      if (typeof existing === 'function') continue
    }
    Object.defineProperty(proto, name, { value: fn, writable: true, configurable: true })
  }
}

export function repository<P extends Entity<IEntityData>>(config: IRepositoryConfig<P>) {
  return function (target: IConstructor<any>) {
    const store = container.resolve(RepositoryMetadataStore)
    store.saveRepositoryConfig(target, config)

    installCrudMethods(target)

    const queryMethods = store.getQueryMethods(target)
    for (const meta of queryMethods) {
      if (Object.prototype.hasOwnProperty.call(target.prototype, meta.functionName)) {
        const existing = target.prototype[meta.functionName]
        if (typeof existing === 'function' && existing.length > 0) {
          continue
        }
      }
      target.prototype[meta.functionName] = makeQueryImpl(meta.functionName)
    }

    singleton()(target)
  }
}
