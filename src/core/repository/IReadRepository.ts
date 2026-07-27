import { Entity, IEntityData } from '../entity'
import { IPage, IPageOptions } from './pagination'

/**
 * The read half of a repository. A CQRS read model / replica-backed repository
 * exposes only this — no create/update/delete — so writes are impossible by type.
 */
export interface IReadRepository<T extends Entity<IEntityData>> {
  find(id: string): Promise<T | null>
  findOrThrow(id: string): Promise<T>
  findByIds(ids: string[]): Promise<T[]>
  findAll(): Promise<T[]>
  /** Cursor (keyset) page of all entities, newest first. */
  findPage(options: IPageOptions): Promise<IPage<T>>
}
