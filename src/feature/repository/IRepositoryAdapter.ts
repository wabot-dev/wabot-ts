import { Entity, IEntityData } from '@/core/entity'
import { IConstructor } from '@/core/generics'
import { IRepositoryConfig } from './IRepositoryConfig'
import { IRepositoryRuntime } from './IRepositoryRuntime'

export interface IRepositoryAdapter {
  readonly id: symbol
  build<P extends Entity<IEntityData>>(config: IRepositoryConfig<P>): IRepositoryRuntime<P>
  buildExtension?<E>(config: IRepositoryConfig<any>, ExtensionCtor: IConstructor<E>): E
}
