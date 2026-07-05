import { Entity, IEntityData } from '../entity'
import { ICrudRepository } from './ICrudRepository'

export class CrudRepository<T extends Entity<IEntityData>, Ext = never>
  implements ICrudRepository<T>
{
  declare protected readonly extension: Ext

  find(id: string): Promise<T | null> {
    throw new Error('Method not implemented.')
  }
  findOrThrow(id: string): Promise<T> {
    throw new Error('Method not implemented.')
  }
  findByIds(ids: string[]): Promise<T[]> {
    throw new Error('Method not implemented.')
  }
  findAll(id: string): Promise<T[]> {
    throw new Error('Method not implemented.')
  }
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
