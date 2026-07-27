import { IConstructor } from '@/core/generics'
import { container } from '@/core/injection'
import { CrudRepository } from '@/core/repository'
import { MemoryProjectionExtension } from './MemoryProjectionExtension'
import { MEMORY_ADAPTER_ID, MemoryRepositoryExtension } from './MemoryRepositoryAdapter'
import { RepositoryMetadataStore } from './RepositoryMetadataStore'

type ExtensionOf<R> = R extends CrudRepository<any, infer Ext> ? Ext : never

function inheritsFrom(ctor: Function, base: Function): boolean {
  let proto: any = ctor.prototype
  while (proto) {
    if (proto === base.prototype) return true
    proto = Object.getPrototypeOf(proto)
  }
  return false
}

/**
 * Register the in-memory implementation of a repository's `@queryExtension`
 * methods, or of a whole `@projection`.
 */
export function memExtension<R extends object>(repositoryClass: IConstructor<R>) {
  if (typeof repositoryClass !== 'function') {
    throw new Error(
      `@memoryExtension: repository argument must be a class, ` + `got ${typeof repositoryClass}`,
    )
  }
  return function <
    E extends (MemoryRepositoryExtension<any> & ExtensionOf<R>) | MemoryProjectionExtension,
  >(target: IConstructor<E>): void {
    if (
      !inheritsFrom(target, MemoryRepositoryExtension) &&
      !inheritsFrom(target, MemoryProjectionExtension)
    ) {
      throw new Error(
        `@memoryExtension on ${target.name}: extension class must extend ` +
          `MemoryRepositoryExtension (a repository) or MemoryProjectionExtension (a projection).`,
      )
    }
    const store = container.resolve(RepositoryMetadataStore)
    store.saveExtension(repositoryClass, MEMORY_ADAPTER_ID, target)
  }
}
