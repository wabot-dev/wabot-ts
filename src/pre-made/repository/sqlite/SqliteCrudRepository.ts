import type { IPersistent, IReversibleMapper, Persistent } from '@/shared'
import type { ICrudRepository } from '../ICrudRepository'

import { promises as fs } from 'fs'
import path from 'path'
import { type Database, open } from 'sqlite'
import sqlite3 from 'sqlite3'
import { v4 as uuidv4 } from 'uuid'
import type { ISqliteRecord } from './ISqliteRecord'

export class SqliteCrudRepository<P extends Persistent<IPersistent>> implements ICrudRepository<P> {
  private tableCreated = false

  constructor(
    private table: string,
    private dbPath: string,
    private mapper: IReversibleMapper<P, string>,
  ) {}

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
    item['data'].createdAt = new Date().getTime()
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
    await db.run(`UPDATE ${this.table} SET data=? WHERE id=?`, [
      this.mapper.map(item),
      item.getId(),
    ])
    db.close()
  }

  async discard(item: P): Promise<void> {
    item.discard()
    await this.update(item)
  }

  protected async getDb() {
    const dbDirPath = path.dirname(this.dbPath)
    await fs.mkdir(dbDirPath, { recursive: true })

    const db = await open({
      filename: this.dbPath,
      driver: sqlite3.Database,
    })

    if (!this.tableCreated) {
      this.tableCreated = true
      await this.createTable(db)
    }
    return db
  }

  protected async createTable(db: Database<sqlite3.Database, sqlite3.Statement>) {
    await db.exec(
      `CREATE TABLE IF NOT EXISTS ${this.table}(id TEXT, created_at INTEGER, data TEXT)`,
    )
  }
}
