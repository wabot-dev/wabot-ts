import { Entity, IEntityData } from '../entity'
import { ICrudRepository } from './ICrudRepository'
import { ReadRepository } from './ReadRepository'

/** Base for a full repository: read methods (from `ReadRepository`) plus writes. */
export class CrudRepository<T extends Entity<IEntityData>, Ext = never>
  extends ReadRepository<T, Ext>
  implements ICrudRepository<T>
{
  create(item: T): Promise<void> {
    throw new Error('Method not implemented.')
  }
  update(item: T): Promise<void> {
    throw new Error('Method not implemented.')
  }
  delete(item: T): Promise<void> {
    throw new Error('Method not implemented.')
  }
}
