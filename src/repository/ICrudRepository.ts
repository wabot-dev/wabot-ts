export interface ICrudRepository<T> {
  find(id: string): Promise<T | null>
  findOrThrow(id: string): Promise<T>
  findByIds(ids: string[]): Promise<T[]>
  findAll(id: string): Promise<T[]>
  create(item: T): Promise<void>
  update(item: T): Promise<void>
  discard(item: T): Promise<void>
}
