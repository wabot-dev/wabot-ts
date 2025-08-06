import { Pool } from 'pg'
import * as shortUUID from 'short-uuid'
import type { ICrudRepository } from '../ICrudRepository'
import { type IPgRepositoryConfig } from './IPgRepositoryConfig'
import { PgRepositoryBase } from './PgRepositoryBase'
import type { Persistent } from '@/core'

export class PgCrudRepository<P extends Persistent>
  extends PgRepositoryBase<P>
  implements ICrudRepository<P>
{
  constructor(
    pool: Pool,
    protected readonly config: IPgRepositoryConfig<P>,
  ) {
    super(pool, config)
  }

  async find(id: string): Promise<P | null> {
    const sql = `
      SELECT ${this.columns}
        FROM ${this.table}
       WHERE id = $1
       LIMIT 1
    `
    const items = await this.query(sql, [id])
    return items.at(0) ?? null
  }

  async findOrThrow(id: string): Promise<P> {
    const item = await this.find(id)
    if (!item) {
      throw new Error(`Not found ${this.config.constructor.name} with id = '${id}'`)
    }
    return item
  }

  async findAll(): Promise<P[]> {
    const sql = `
      SELECT ${this.columns}
        FROM ${this.table}
    `
    const items = await this.query(sql, [])
    return items
  }

  async create(item: P): Promise<void> {
    if (item.wasCreated()) {
      throw new Error('Item already created')
    }

    item['data'].id = shortUUID.default.generate()
    item['data'].createdAt = new Date().getTime()
    item.validate()

    const sql = `
      INSERT INTO 
        ${this.table}(${this.columns})
      VALUES (${this.vars})
    `
    await this.exec(sql, this.values(item))
  }

  async update(item: P): Promise<void> {
    item.validate()

    const sql = `
      UPDATE ${this.table}
         SET ${this.updates}
      WHERE id = $${this.columnsList.length + 1}
    `
    await this.exec(sql, [...this.values(item), item.getId()])
  }

  async discard(item: P): Promise<void> {
    const _item = await this.find(item.getId())
    if (!_item) {
      throw new Error('Not found')
    }
    item.discard()
    _item.discard()
    await this.update(_item)
  }
}
