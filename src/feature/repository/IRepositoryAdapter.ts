import { Entity, IEntityData } from '@/core/entity'
import { IRepositoryConfig } from './IRepositoryConfig'
import { IRepositoryRuntime } from './IRepositoryRuntime'

export interface IRepositoryAdapter {
  build<P extends Entity<IEntityData>>(config: IRepositoryConfig<P>): IRepositoryRuntime<P>
}
