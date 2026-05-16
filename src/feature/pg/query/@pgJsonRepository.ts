import { Entity, IEntityData } from '@/core/entity'
import { IPgRepositoryConfig } from '../IPgRepositoryConfig'
import { IRepositoryConfig, repository } from '@/feature/repository'

export function pgJsonRepository<P extends Entity<IEntityData>>(config: IPgRepositoryConfig<P>) {
  return repository(config as unknown as IRepositoryConfig<P>)
}
