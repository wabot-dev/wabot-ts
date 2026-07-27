import { Entity, IEntityData } from '@/core/entity'
import { IConstructor } from '@/core/generics'
import { IStorageDeclaration } from '@/core/repository'
import { IProjectionConfig } from './IProjectionConfig'
import { IProjectionRuntime } from './IProjectionRuntime'
import { IRepositoryConfig } from './IRepositoryConfig'
import { IRepositoryRuntime } from './IRepositoryRuntime'

export interface IRepositoryAdapter {
  readonly id: symbol
  /**
   * Build the CRUD/query runtime for a repository.
   *
   * `storage` is what the repository class itself declares by extending an
   * engine base (`PgColumnsRepository`, …); a backend that serves more than one
   * strategy picks the runtime from it, and falls back to its own default when
   * the repository declares nothing. Backends with a single strategy — memory —
   * ignore it, which is what lets any repository run without a database.
   *
   * `extensionCtor` is the repository's registered db extension, if any.
   */
  build<P extends Entity<IEntityData>>(
    config: IRepositoryConfig<P>,
    extensionCtor?: IConstructor<any>,
    storage?: IStorageDeclaration,
  ): IRepositoryRuntime<P>
  buildExtension?<E>(config: IRepositoryConfig<any>, ExtensionCtor: IConstructor<E>): E
  /**
   * Run a projection's own statements. Implemented only by backends that speak
   * a query language; leaving it out is what tells `@projection` to serve the
   * projection through its registered extension instead.
   */
  buildProjection?(config: IProjectionConfig): IProjectionRuntime
}
