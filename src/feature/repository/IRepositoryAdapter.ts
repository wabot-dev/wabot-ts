import { Entity, IEntityData } from '@/core/entity'
import { IConstructor } from '@/core/generics'
import { IRepositoryConfig } from './IRepositoryConfig'
import { IRepositoryRuntime } from './IRepositoryRuntime'

export interface IRepositoryAdapter {
  readonly id: symbol
  /**
   * Build the CRUD/query runtime for a repository. `extensionCtor` is the
   * repository's registered db extension (if any); a backend that supports more
   * than one storage strategy uses the class it extends to pick the runtime.
   * Backends with a single strategy may ignore it.
   */
  build<P extends Entity<IEntityData>>(
    config: IRepositoryConfig<P>,
    extensionCtor?: IConstructor<any>,
  ): IRepositoryRuntime<P>
  buildExtension?<E>(config: IRepositoryConfig<any>, ExtensionCtor: IConstructor<E>): E
}
