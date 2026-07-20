import { Entity, IEntityData } from '../entity'
import { IReadRepository } from './IReadRepository'
import { IPage, IPageOptions } from './pagination'

/**
 * Base for a **read-only** repository (a CQRS read model). Extend it and add
 * `@query` finder / `count` / `exists` methods; `@repository` installs the read
 * methods and refuses mutation queries (`deleteBy…`). There is no
 * create/update/delete — the type itself prevents writes, so it is safe to point
 * at a read replica via `@repository({ pool })`.
 */
export class ReadRepository<T extends Entity<IEntityData>, Ext = never>
  implements IReadRepository<T>
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
  findAll(): Promise<T[]> {
    throw new Error('Method not implemented.')
  }
  findPage(options: IPageOptions): Promise<IPage<T>> {
    throw new Error('Method not implemented.')
  }
}
