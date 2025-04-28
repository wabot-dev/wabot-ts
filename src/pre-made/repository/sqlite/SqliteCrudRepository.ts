import type { IReversibleMapper } from '@/shared'
import type { ICrudRepository } from '../ICrudRepository'
import { type IPersistent, Persistent } from '../Persistent'

import { v4 as uuidv4 } from 'uuid'
import { open } from 'sqlite'
import sqlite3 from 'sqlite3-offline-next'
import type { ISqliteRecord } from './ISqliteRecord'

export class SqliteCrudRepository<P extends Persistent<IPersistent>> implements ICrudRepository<P> {
  constructor(
    private table: string,
    private dbPath: string,
    private mapper: IReversibleMapper<P, string>,
  ) {
    this.createTable()
  }

  async find(id: string): Promise<P | null> {
    const db = await this.getDb()
    const result = await db.all<ISqliteRecord[]>(`SELECT id, data FROM ${this.table} WHERE id=?`, [
      id,
    ])
    db.close()

    if (result.length < 1) {
      return null
    }

    const item = this.mapper.rev(result[0].data)
    return item
  }

  async findAll(): Promise<P[]> {
    const db = await this.getDb()
    const result = await db.all<ISqliteRecord[]>(`SELECT id, data FROM ${this.table}`)
    db.close()

    const items = result.map((item) => this.mapper.rev(item.data))
    return items
  }

  async create(item: P): Promise<void> {
    if (item.wasCreated()) {
      throw new Error('Item already created')
    }
    item['data'].id = uuidv4()
    item['data'].createdAt = new Date()
    item.validate()

    const db = await this.getDb()
    await db.run(`INSERT INTO ${this.table} VALUES (?, ?, ?)`, [
      item.getId(),
      item.getCreatedAt().getTime(),
      this.mapper.map(item),
    ])
    db.close()
  }

  async update(item: P): Promise<void> {
    if (!item.wasCreated()) {
      throw new Error('Item is not created')
    }
    item.validate()

    const db = await this.getDb()
    await db.run(`UPDATA chat SET data=? WHERE id=?`, [this.mapper.map(item), item.getId()])
    db.close()
  }

  async discard(item: P): Promise<void> {
    item.discard()
    await this.update(item)
  }

  protected async createTable() {
    const db = await this.getDb()
    await db.exec(
      `CREATE TABLE IF NOT EXISTS ${this.table}(id TEXT, created_at INTEGER, data TEXT)`,
    )
    db.close()
  }

  protected async getDb() {
    const db = await open({
      filename: this.dbPath,
      driver: sqlite3.Database,
    })
    return db
  }
}
