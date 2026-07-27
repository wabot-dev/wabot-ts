import { Entity, IEntityData } from '../entity'
import { IReadRepository } from './IReadRepository'

/** A full repository: the read half plus mutations. */
export interface ICrudRepository<T extends Entity<IEntityData>> extends IReadRepository<T> {
  create(item: T): Promise<void>
  update(item: T): Promise<void>
  delete(item: T): Promise<void>
}
