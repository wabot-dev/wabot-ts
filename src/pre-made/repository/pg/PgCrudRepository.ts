import type { IPersistent, IReversibleMapper, Persistent } from '@/shared'
import type { ICrudRepository } from '../ICrudRepository'
import { Pool } from 'pg'
import type { IPgRecord } from './IPgRecord'

export class PgCrudRepository<P extends Persistent<IPersistent>> implements ICrudRepository<P> {
  private tableIsCreated = false

  constructor(
    private readonly pool: Pool,
    protected readonly tableName: string,
    protected mapper: IReversibleMapper<P, string>,
  ) {}

  async find(id: string): Promise<P | null> {
    const sql = `
      SELECT id, data
        FROM ${this.tableName}
       WHERE id = $1
       LIMIT 1
    `
    await this.createTableIfNotExists()
    const { rows } = await this.pool.query<IPgRecord>(sql, [id])
    if (rows.length === 0) return null
    return this.mapper.rev(rows[0].data)
  }

  async findAll(): Promise<P[]> {
    const sql = `SELECT id, data FROM ${this.tableName}`
    await this.createTableIfNotExists()
    const { rows } = await this.pool.query<IPgRecord>(sql)
    return rows.map((r) => this.mapper.rev(r.data))
  }

  async create(item: P): Promise<void> {
    const sql = `
      INSERT INTO ${this.tableName}(id, data)
      VALUES ($1, $2)
    `
    const data = this.mapper.map(item)
    await this.createTableIfNotExists()
    await this.pool.query(sql, [item.getId(), data])
  }

  async update(item: P): Promise<void> {
    const sql = `
      UPDATE ${this.tableName}
         SET data = $1
       WHERE id = $2
    `
    const data = this.mapper.map(item)
    await this.createTableIfNotExists()
    await this.pool.query(sql, [data, item.getId()])
  }

  async discard(item: P): Promise<void> {
    item.discard()
    await this.update(item)
  }

  protected async getPool() {
    await this.createTableIfNotExists()
    return this.pool
  }

  private async createTableIfNotExists() {
    if (this.tableIsCreated) {
      return
    }
    await this.pool.query(
      `CREATE TABLE IF NOT EXISTS ${this.tableName} (
         id TEXT PRIMARY KEY,
         data JSONB NOT NULL
       )`,
    )
  }
}
