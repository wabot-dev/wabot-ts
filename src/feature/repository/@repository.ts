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
const EXTENSION_KEY = Symbol('wabot:repositoryExtension')
const AST_CACHE_KEY = Symbol('wabot:repositoryAstCache')

function getConfig(self: any): IRepositoryConfig<any> {
  const ctor = self.constructor as IConstructor<any>
  const config = container.resolve(RepositoryMetadataStore).getRepositoryConfig(ctor)
  if (!config) {
    throw new Error(`${ctor.name} must be decorated with @repository`)
  }
  return config
}

function getRuntime<P extends Entity<IEntityData>>(self: any): IRepositoryRuntime<P> {
  let runtime: IRepositoryRuntime<P> | undefined = self[RUNTIME_KEY]
  if (runtime) return runtime

  const config = getConfig(self)
  const adapter = container.resolve(RepositoryAdapterRegistry).getDefault()
  runtime = adapter.build(config) as IRepositoryRuntime<P>
  Object.defineProperty(self, RUNTIME_KEY, { value: runtime, enumerable: false })
  return runtime
}

function getExtension(self: any): unknown {
  const cached = self[EXTENSION_KEY]
  if (cached !== undefined) return cached

  const ctor = self.constructor as IConstructor<any>
  const adapter = container.resolve(RepositoryAdapterRegistry).getDefault()
  const store = container.resolve(RepositoryMetadataStore)
  const ExtensionCtor = store.getExtension(ctor, adapter.id)
  if (!ExtensionCtor) {
    throw new Error(
      `${ctor.name}.extension is not available: no extension registered ` +
        `for adapter "${adapter.id.description ?? 'unknown'}". ` +
        `Import the extension class so its @<adapter>Extension decorator runs, ` +
        `or check the active adapter.`,
    )
  }
  if (typeof adapter.buildExtension !== 'function') {
    throw new Error(
      `${ctor.name}.extension cannot be built: adapter ` +
        `"${adapter.id.description ?? 'unknown'}" does not implement buildExtension().`,
    )
  }
  const config = getConfig(self)
  const ext = adapter.buildExtension(config, ExtensionCtor)
  Object.defineProperty(self, EXTENSION_KEY, { value: ext, enumerable: false })
  return ext
}

function installExtensionAccessor(target: IConstructor<any>) {
  const proto = target.prototype
  if (Object.getOwnPropertyDescriptor(proto, 'extension')) return
  Object.defineProperty(proto, 'extension', {
    get(this: any) {
      return getExtension(this)
    },
    configurable: true,
    enumerable: false,
  })
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
    installExtensionAccessor(target)

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
