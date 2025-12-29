import { Env } from "@/core/env"
import { container, singleton } from "@/core/injection"
import { JobRepository } from "@/feature/async"
import { Pool } from "pg"
import { PgJobRepository } from "./PgJobRepository"
import { PgLock } from "@/addon/lock/pg"
import { Lock } from "@/core/lock"
import { PgCrudRepository } from "@/feature/pg"
import { ITagRepository, Tag, TagRepository } from "@/feature/async/testRunCommand"

@singleton()
class PgTagRepository extends PgCrudRepository<Tag> implements ITagRepository {
  constructor(pool: Pool) {
    super(pool, {
      table: 'tag',
      schema: 'wabot_test',
      constructor: Tag,
    })
  }

  async findByValue(value: string): Promise<Tag[]> {
    const sql = `
      SELECT ${this.columns}
      FROM ${this.table} 
      WHERE data @> $1::jsonb
    `
    const items = await this.query(sql, [JSON.stringify({ value })])
    return items
  }
}

const env = container.resolve(Env)
container.registerInstance(Pool, new Pool({ connectionString: env.requireString('DATABASE_URL') }))
container.registerType(JobRepository, PgJobRepository)
container.registerType(TagRepository, PgTagRepository)
container.registerType(Lock, PgLock)
