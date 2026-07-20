import { Entity, IEntityData } from '@/core/entity'
import { CrudRepository, ReadRepository } from '@/core/repository'
import { container, singleton } from '@/core/injection'
import { IConstructor } from '@/core/generics'
import { IQueryAst } from './types'
import { deriveIndexes, mergeIndexes } from './indexes'
import { IRepositoryConfig } from './IRepositoryConfig'
import { IRepositoryRuntime } from './IRepositoryRuntime'
import { countConditionArgs, IPageOptions, isPageOptions } from './pagination'
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

// The repo's `pool` provider picks which database's adapter serves it; no `pool`
// falls back to the default database.
function getAdapterFor(config: IRepositoryConfig<any>) {
  const registry = container.resolve(RepositoryAdapterRegistry)
  return config.pool ? registry.getForProvider(config.pool) : registry.getDefault()
}

function getRuntime<P extends Entity<IEntityData>>(self: any): IRepositoryRuntime<P> {
  let runtime: IRepositoryRuntime<P> | undefined = self[RUNTIME_KEY]
  if (runtime) return runtime

  const config = getConfig(self)
  const adapter = getAdapterFor(config)
  // The repo's db extension (if any) selects the backend's storage strategy via
  // the base class it extends; undefined falls back to the backend default.
  const ctor = self.constructor as IConstructor<any>
  const extensionCtor = container.resolve(RepositoryMetadataStore).getExtension(ctor, adapter.id)
  runtime = adapter.build(config, extensionCtor) as IRepositoryRuntime<P>
  Object.defineProperty(self, RUNTIME_KEY, { value: runtime, enumerable: false })
  return runtime
}

function getExtension(self: any): unknown {
  const cached = self[EXTENSION_KEY]
  if (cached !== undefined) return cached

  const ctor = self.constructor as IConstructor<any>
  const adapter = getAdapterFor(getConfig(self))
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

function makeExtensionImpl(methodName: string) {
  return function (this: any, ...args: unknown[]): unknown {
    const ext = getExtension(this) as Record<string, unknown>
    const fn = ext[methodName]
    if (typeof fn !== 'function') {
      throw new Error(
        `${this.constructor.name}.${methodName}: ` +
          `the active adapter's extension does not implement this method.`,
      )
    }
    return (fn as (...a: unknown[]) => unknown).apply(ext, args)
  }
}

function makeQueryImpl(methodName: string) {
  return async function (this: any, ...args: unknown[]): Promise<unknown> {
    const ast = getAst(this, methodName)
    const runtime = getRuntime(this)
    switch (ast.prefix) {
      case 'find': {
        // A trailing IPageOptions (after the condition args) switches a `find…`
        // method to keyset pagination: same filter, cursor-ordered page.
        const conditionArgs = countConditionArgs(ast.conditions)
        const pageOptions = args[conditionArgs]
        if (args.length === conditionArgs + 1 && isPageOptions(pageOptions)) {
          return runtime.runPage(ast.conditions, args.slice(0, conditionArgs), pageOptions)
        }
        return runtime.runQuery(ast, args)
      }
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

const READ_METHODS = {
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
  async findPage(this: any, options: IPageOptions) {
    return getRuntime(this).runPage([], [], options)
  },
}

const WRITE_METHODS = {
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

// A repository is read-only when it extends ReadRepository but not the full
// CrudRepository — its type has no writes, so we install only the read methods.
function inheritsFrom(ctor: Function, base: Function): boolean {
  let proto: any = ctor.prototype
  while (proto) {
    if (proto === base.prototype) return true
    proto = Object.getPrototypeOf(proto)
  }
  return false
}

function isReadOnlyRepository(target: IConstructor<any>): boolean {
  return inheritsFrom(target, ReadRepository) && !inheritsFrom(target, CrudRepository)
}

function installCrudMethods(target: IConstructor<any>, readOnly: boolean) {
  const proto = target.prototype
  const methods = readOnly ? READ_METHODS : { ...READ_METHODS, ...WRITE_METHODS }
  for (const [name, fn] of Object.entries(methods)) {
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

    const readOnly = isReadOnlyRepository(target)
    installCrudMethods(target, readOnly)
    installExtensionAccessor(target)

    const queryMethods = store.getQueryMethods(target)

    // Auto-derive indexes from the declared query methods and merge them with
    // any explicit `indexes`. Backends that manage schema (Postgres JSONB) read
    // config.indexes to create them; the memory backend ignores them.
    const derivedIndexes = deriveIndexes(
      queryMethods.map((m) => parseQueryMethodName(m.functionName)),
    )
    config.indexes = mergeIndexes(config.indexes ?? [], derivedIndexes)

    for (const meta of queryMethods) {
      if (readOnly && parseQueryMethodName(meta.functionName).prefix === 'delete') {
        throw new Error(
          `${target.name}.${meta.functionName}: a read-only repository (extends ReadRepository) ` +
            `cannot declare a mutation query. Use a CrudRepository if it must write.`,
        )
      }
      if (Object.prototype.hasOwnProperty.call(target.prototype, meta.functionName)) {
        const existing = target.prototype[meta.functionName]
        if (typeof existing === 'function' && existing.length > 0) {
          continue
        }
      }
      target.prototype[meta.functionName] = makeQueryImpl(meta.functionName)
    }

    const extensionMethods = store.getExtensionMethods(target)
    for (const meta of extensionMethods) {
      if (Object.prototype.hasOwnProperty.call(target.prototype, meta.functionName)) {
        const existing = target.prototype[meta.functionName]
        if (typeof existing === 'function' && existing.length > 0) {
          continue
        }
      }
      target.prototype[meta.functionName] = makeExtensionImpl(meta.functionName)
    }

    singleton()(target)
  }
}
