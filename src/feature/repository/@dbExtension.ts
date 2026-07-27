import { IConstructor } from '@/core/generics'
import { container } from '@/core/injection'
import { CrudRepository, describeStorage, IStorageDeclaration, storageOf } from '@/core/repository'
import { DbRepositoryExtension } from './DbRepositoryExtension'
import { RepositoryMetadataStore } from './RepositoryMetadataStore'

/**
 * The single slot id for a repository's database extension: there is at most
 * one per repository, whatever engine it belongs to. The memory backend keeps
 * its own `MEMORY_ADAPTER_ID` slot, and the active backend (from the
 * connection) decides which slot is read at runtime.
 *
 * The storage strategy is not decided here — the repository declares it by the
 * base class it extends ({@link storageOf}); the extension only has to agree.
 */
export const DB_EXTENSION_ID = Symbol('wabot:db-extension')

type ExtensionOf<R> = R extends CrudRepository<any, infer Ext> ? Ext : never

function sameStorage(a: IStorageDeclaration, b: IStorageDeclaration): boolean {
  return a.engine === b.engine && a.strategy === b.strategy
}

function inheritsFrom(ctor: Function, base: Function): boolean {
  let proto: any = ctor.prototype
  while (proto) {
    if (proto === base.prototype) return true
    proto = Object.getPrototypeOf(proto)
  }
  return false
}

/**
 * Register a class as THE database extension of a repository — where its
 * hand-written SQL lives. The class must extend an extension base for the
 * repository's engine and strategy (e.g. `PgJsonbRepositoryExtension`,
 * `PgColumnsRepositoryExtension`); a base that serves another strategy than the
 * one the repository declares is refused here, at import time. When a database
 * is connected the repository resolves through this extension; with no
 * connection it falls back to the memory extension.
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
          `extension base (e.g. PgJsonbRepositoryExtension, PgColumnsRepositoryExtension).`,
      )
    }
    // Both classes are in hand at import time, so a repository and an extension
    // that disagree on storage fail here rather than at the first query — and
    // long before a database is even connected.
    const repoStorage = storageOf(repositoryClass)
    const extStorage = storageOf(target)
    if (repoStorage && extStorage && !sameStorage(repoStorage, extStorage)) {
      throw new Error(
        `@dbExtension on ${target.name}: ${repositoryClass.name} declares ` +
          `${describeStorage(repoStorage)} storage, but this extension serves ` +
          `${describeStorage(extStorage)}.`,
      )
    }
    container
      .resolve(RepositoryMetadataStore)
      .saveExtension(repositoryClass, DB_EXTENSION_ID, target)
  }
}
