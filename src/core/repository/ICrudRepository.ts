import { Entity, IEntityData } from '../entity'
import { IPage, IPageOptions } from './pagination'

export interface ICrudRepository<T extends Entity<IEntityData>> {
  find(id: string): Promise<T | null>
  findOrThrow(id: string): Promise<T>
  findByIds(ids: string[]): Promise<T[]>
  findAll(id: string): Promise<T[]>
  /** Cursor (keyset) page of all entities, newest first. */
  findPage(options: IPageOptions): Promise<IPage<T>>
  create(item: T): Promise<void>
  update(item: T): Promise<void>
  delete(item: T): Promise<void>
}
