import { IConstructor } from '@/core/generics'
import { container } from '@/core/injection'
import { IProjectionConfig } from './IProjectionConfig'
import { IProjectionRuntime } from './IProjectionRuntime'
import { PROJECTION_RUNTIME } from './Projection'
import { RepositoryAdapterRegistry } from './RepositoryAdapterRegistry'
import { RepositoryMetadataStore } from './RepositoryMetadataStore'

const EXTENSION_KEY = Symbol('wabot:projectionExtension')

function adapterFor(config: IProjectionConfig) {
  const registry = container.resolve(RepositoryAdapterRegistry)
  return config.pool ? registry.getForProvider(config.pool) : registry.getDefault()
}

/**
 * The instance serving this projection on a backend that cannot run statements,
 * or `undefined` when the backend runs the projection's own SQL. Resolved
 * through the container — a projection extension has no store to be handed, so
 * it is free to inject whatever repositories it derives its answer from.
 */
function memoryImplementation(self: any, config: IProjectionConfig): any | undefined {
  const adapter = adapterFor(config)
  if (typeof adapter.buildProjection === 'function') {
    if (!self[PROJECTION_RUNTIME]) {
      const runtime: IProjectionRuntime = adapter.buildProjection(config)
      Object.defineProperty(self, PROJECTION_RUNTIME, { value: runtime, enumerable: false })
    }
    return undefined
  }

  const cached = self[EXTENSION_KEY]
  if (cached) return cached

  const ctor = self.constructor as IConstructor<any>
  const ExtensionCtor = container.resolve(RepositoryMetadataStore).getExtension(ctor, adapter.id)
  if (!ExtensionCtor) {
    throw new Error(
      `${ctor.name}: the active backend cannot run the projection's statements and no ` +
        `implementation is registered for adapter "${adapter.id.description ?? 'unknown'}". ` +
        `Write one and register it with @memExtension(${ctor.name}).`,
    )
  }
  const instance = container.resolve(ExtensionCtor)
  Object.defineProperty(self, EXTENSION_KEY, { value: instance, enumerable: false })
  return instance
}

/**
 * Declare a class a projection: a read-only object built by its own statements
 * instead of mapped to a table. See {@link Projection} for what the class looks
 * like.
 *
 * The class body is the implementation for backends that speak a query
 * language. On one that does not — the in-memory backend — every call is served
 * by the `@memExtension` registered for the projection, method by method under
 * the same name, so development without a database exercises a real answer
 * rather than a stub.
 *
 * The only thing to configure is which database answers, and only when it isn't
 * the default one.
 */
export function projection(config: IProjectionConfig = {}) {
  return function (target: IConstructor<any>): void {
    container.resolve(RepositoryMetadataStore).saveProjectionConfig(target, config)

    for (const name of Object.getOwnPropertyNames(target.prototype)) {
      if (name === 'constructor') continue
      const descriptor = Object.getOwnPropertyDescriptor(target.prototype, name)
      const original = descriptor?.value
      if (typeof original !== 'function') continue

      Object.defineProperty(target.prototype, name, {
        ...descriptor,
        value: function (this: any, ...args: unknown[]) {
          const implementation = memoryImplementation(this, config)
          if (!implementation) {
            return original.apply(this, args)
          }
          const method = implementation[name]
          if (typeof method !== 'function') {
            throw new Error(
              `${implementation.constructor.name} does not implement "${name}", declared by ` +
                `${target.name}. A projection has to answer on every backend it runs on.`,
            )
          }
          return method.apply(implementation, args)
        },
      })
    }
  }
}
