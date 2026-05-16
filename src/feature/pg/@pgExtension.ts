import { IConstructor } from '@/core/generics'
import { container } from '@/core/injection'
import { CrudRepository } from '@/core/repository'
import { RepositoryMetadataStore } from '@/feature/repository'
import { PgRepositoryBase } from './PgRepositoryBase'

export const PG_ADAPTER_ID = Symbol('wabot:pg-adapter')

type ExtensionOf<R> = R extends CrudRepository<any, infer Ext> ? Ext : never

function inheritsFrom(ctor: Function, base: Function): boolean {
  let proto: any = ctor.prototype
  while (proto) {
    if (proto === base.prototype) return true
    proto = Object.getPrototypeOf(proto)
  }
  return false
}

export function pgExtension<R extends CrudRepository<any, any>>(
  repositoryClass: IConstructor<R>,
) {
  if (typeof repositoryClass !== 'function') {
    throw new Error(
      `@pgExtension: repository argument must be a class, ` +
        `got ${typeof repositoryClass}`,
    )
  }
  return function <E extends PgRepositoryBase<any> & ExtensionOf<R>>(
    target: IConstructor<E>,
  ): void {
    if (!inheritsFrom(target, PgRepositoryBase)) {
      throw new Error(
        `@pgExtension on ${target.name}: extension class must extend ` +
          `PgRepositoryExtension.`,
      )
    }
    const store = container.resolve(RepositoryMetadataStore)
    store.saveExtension(repositoryClass, PG_ADAPTER_ID, target)
  }
}
