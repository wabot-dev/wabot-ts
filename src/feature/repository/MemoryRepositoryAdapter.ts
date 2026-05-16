import { generate as generateShortUuid } from 'short-uuid'

import { Entity, IEntityData } from '@/core/entity'
import { CustomError } from '@/core/error'
import { evaluateQueryAst } from './evaluateQueryAst'
import { IRepositoryAdapter } from './IRepositoryAdapter'
import { IRepositoryConfig } from './IRepositoryConfig'
import { IRepositoryRuntime } from './IRepositoryRuntime'
import { IQueryAst } from './types'

function cloneEntity<P extends Entity<IEntityData>>(
  config: IRepositoryConfig<P>,
  item: P,
): P {
  const data = JSON.parse(JSON.stringify(item['data']))
  return new config.constructor(data)
}

class MemoryRepositoryRuntime<P extends Entity<IEntityData>> implements IRepositoryRuntime<P> {
  private items = new Map<string, P>()

  constructor(private readonly config: IRepositoryConfig<P>) {}

  async find(id: string): Promise<P | null> {
    const item = this.items.get(id)
    return item ? cloneEntity(this.config, item) : null
  }

  async findOrThrow(id: string): Promise<P> {
    const item = await this.find(id)
    if (!item) {
      throw new CustomError({
        message: `Not found ${this.config.constructor.name} with id = '${id}'`,
        httpCode: 404,
      })
    }
    return item
  }

  async findByIds(ids: string[]): Promise<P[]> {
    const out: P[] = []
    for (const id of ids) {
      const item = this.items.get(id)
      if (item) out.push(cloneEntity(this.config, item))
    }
    return out
  }

  async findAll(): Promise<P[]> {
    return [...this.items.values()].map((i) => cloneEntity(this.config, i))
  }

  async create(item: P): Promise<void> {
    if (item.wasCreated()) {
      throw new Error('Item already created')
    }
    item['data'].id = generateShortUuid()
    item['data'].createdAt = new Date().getTime()
    item.validate()
    this.items.set(item.id, cloneEntity(this.config, item))
  }

  async update(item: P): Promise<void> {
    item.validate()
    if (!this.items.has(item.id)) {
      throw new Error(`Update failed: no affected rows`)
    }
    this.items.set(item.id, cloneEntity(this.config, item))
  }

  async delete(item: P): Promise<void> {
    this.items.delete(item.id)
  }

  async runQuery(ast: IQueryAst, args: unknown[]): Promise<P[]> {
    const result = evaluateQueryAst(this.items.values(), ast, args)
    return result.map((i) => cloneEntity(this.config, i))
  }

  async runCount(ast: IQueryAst, args: unknown[]): Promise<number> {
    return evaluateQueryAst(this.items.values(), ast, args).length
  }

  async runExists(ast: IQueryAst, args: unknown[]): Promise<boolean> {
    return evaluateQueryAst(this.items.values(), ast, args).length > 0
  }

  async runDelete(ast: IQueryAst, args: unknown[]): Promise<void> {
    const matched = evaluateQueryAst(this.items.values(), ast, args)
    for (const item of matched) {
      this.items.delete(item.id)
    }
  }
}

export class MemoryRepositoryAdapter implements IRepositoryAdapter {
  build<P extends Entity<IEntityData>>(config: IRepositoryConfig<P>): IRepositoryRuntime<P> {
    return new MemoryRepositoryRuntime(config)
  }
}
