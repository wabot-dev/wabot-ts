import { IConstructor } from '@/core/generics'
import { container } from '@/core/injection'
import { CrudRepository } from '@/core/repository'
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

export function memoryExtension<R extends CrudRepository<any, any>>(
  repositoryClass: IConstructor<R>,
) {
  if (typeof repositoryClass !== 'function') {
    throw new Error(
      `@memoryExtension: repository argument must be a class, ` +
        `got ${typeof repositoryClass}`,
    )
  }
  return function <E extends MemoryRepositoryExtension<any> & ExtensionOf<R>>(
    target: IConstructor<E>,
  ): void {
    if (!inheritsFrom(target, MemoryRepositoryExtension)) {
      throw new Error(
        `@memoryExtension on ${target.name}: extension class must extend ` +
          `MemoryRepositoryExtension.`,
      )
    }
    const store = container.resolve(RepositoryMetadataStore)
    store.saveExtension(repositoryClass, MEMORY_ADAPTER_ID, target)
  }
}
