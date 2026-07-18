import { IConstructor } from '@/core/generics'
import { container } from '@/core/injection'
import { CrudRepository } from '@/core/repository'
import { DbRepositoryExtension } from './DbRepositoryExtension'
import { RepositoryMetadataStore } from './RepositoryMetadataStore'

/**
 * The single slot id for a repository's database extension. Which engine and
 * storage strategy it uses is decided by the base class the extension extends —
 * not by this id — so there is at most one db extension per repository. The
 * memory backend keeps its own `MEMORY_ADAPTER_ID` slot, and the active backend
 * (from the connection) decides which slot is read at runtime.
 */
export const DB_EXTENSION_ID = Symbol('wabot:db-extension')

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
 * Register a class as THE database extension of a repository. The class must
 * extend a database extension base (e.g. `PgJsonbRepositoryExtension`,
 * `PgSqlRepositoryExtension`), which is what selects the engine + storage
 * strategy. When a database is connected the repository resolves through this
 * extension; with no connection it falls back to the memory extension.
 */
export function dbExtension<R extends CrudRepository<any, any>>(repositoryClass: IConstructor<R>) {
  if (typeof repositoryClass !== 'function') {
    throw new Error(
      `@dbExtension: repository argument must be a class, got ${typeof repositoryClass}`,
    )
  }
  return function <E extends DbRepositoryExtension & ExtensionOf<R>>(
    target: IConstructor<E>,
  ): void {
    if (!inheritsFrom(target, DbRepositoryExtension)) {
      throw new Error(
        `@dbExtension on ${target.name}: extension class must extend a database ` +
          `extension base (e.g. PgJsonbRepositoryExtension, PgSqlRepositoryExtension).`,
      )
    }
    container
      .resolve(RepositoryMetadataStore)
      .saveExtension(repositoryClass, DB_EXTENSION_ID, target)
  }
}
