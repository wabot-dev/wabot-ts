import { generate as generateShortUuid } from 'short-uuid'
import { singleton } from '@/core/injection'
import { CronJob, type ICronJobRepository } from '@/feature/async'

@singleton()
export class InMemoryCronJobRepository implements ICronJobRepository {
  private items = new Map<string, CronJob>()

  async create(cronJob: CronJob): Promise<void> {
    if (cronJob.wasCreated()) throw new Error('CronJob already created')
    cronJob['data'].id = generateShortUuid()
    cronJob['data'].createdAt = new Date().getTime()
    cronJob.validate()
    this.items.set(cronJob.id, cronJob)
  }

  async findDue(date?: Date): Promise<CronJob[]> {
    const now = (date ?? new Date()).getTime()
    return [...this.items.values()]
      .filter((c) => c['data'].enabled && c['data'].nextRunAt != null && c['data'].nextRunAt <= now)
      .sort((a, b) => (a['data'].nextRunAt ?? 0) - (b['data'].nextRunAt ?? 0))
  }

  async findOrThrow(id: string): Promise<CronJob> {
    const item = this.items.get(id)
    if (!item) throw new Error(`CronJob with id = '${id}' not found`)
    return item
  }

  async update(cronJob: CronJob): Promise<void> {
    if (!cronJob.wasCreated()) throw new Error('CronJob was not created')
    cronJob.validate()
    this.items.set(cronJob.id, cronJob)
  }

  async findByName(name: string): Promise<CronJob | null> {
    for (const c of this.items.values()) {
      if (c['data'].name === name) return c
    }
    return null
  }
}
