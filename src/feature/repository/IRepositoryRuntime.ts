import { Entity, IEntityData } from '@/core/entity'
import { IPage, IPageOptions } from './pagination'
import { IQueryAst, IQueryCondition } from './types'

export interface IRepositoryRuntime<P extends Entity<IEntityData>> {
  find(id: string): Promise<P | null>
  findOrThrow(id: string): Promise<P>
  findByIds(ids: string[]): Promise<P[]>
  findAll(): Promise<P[]>
  create(item: P): Promise<void>
  update(item: P): Promise<void>
  delete(item: P): Promise<void>
  runQuery(ast: IQueryAst, args: unknown[]): Promise<P[]>
  runCount(ast: IQueryAst, args: unknown[]): Promise<number>
  runExists(ast: IQueryAst, args: unknown[]): Promise<boolean>
  runDelete(ast: IQueryAst, args: unknown[]): Promise<void>
  /** Cursor (keyset) page ordered by created_at DESC, id DESC, filtered by `conditions`. */
  runPage(conditions: IQueryCondition[], args: unknown[], options: IPageOptions): Promise<IPage<P>>
}
