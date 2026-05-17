import * as fs from 'node:fs'
import * as path from 'node:path'
import { generate as generateShortUuid } from 'short-uuid'
import { singleton } from '@/core/injection'
import { Logger } from '@/core/logger'
import { CronJob, type ICronJobData, type ICronJobRepository } from '@/feature/async'

const CRON_JOBS_FILE = '.wabot/in-memory/cron-jobs.json'
const MAX_CRON_JOBS = 32

const logger = new Logger('wabot:in-memory-cron-job-repository')

@singleton()
export class InMemoryCronJobRepository implements ICronJobRepository {
  // Insertion order acts as LRU: most-recently-touched at the end.
  private items = new Map<string, CronJob>()

  constructor() {
    this.load()
  }

  async create(cronJob: CronJob): Promise<void> {
    if (cronJob.wasCreated()) throw new Error('CronJob already created')
    cronJob['data'].id = generateShortUuid()
    cronJob['data'].createdAt = new Date().getTime()
    cronJob.validate()
    this.items.set(cronJob.id, cronJob)
    this.enforceLimit()
    this.persist()
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
    this.touch(cronJob)
    this.persist()
  }

  async findByName(name: string): Promise<CronJob | null> {
    for (const c of this.items.values()) {
      if (c['data'].name === name) return c
    }
    return null
  }

  private touch(item: CronJob): void {
    this.items.delete(item.id)
    this.items.set(item.id, item)
  }

  private enforceLimit(): void {
    while (this.items.size > MAX_CRON_JOBS) {
      const oldestKey = this.items.keys().next().value
      if (oldestKey === undefined) break
      this.items.delete(oldestKey)
    }
  }

  private filePath(): string {
    return path.resolve(process.cwd(), CRON_JOBS_FILE)
  }

  private load(): void {
    const file = this.filePath()
    if (!fs.existsSync(file)) return
    try {
      const raw = fs.readFileSync(file, 'utf-8')
      const parsed = JSON.parse(raw) as ICronJobData[]
      if (!Array.isArray(parsed)) return
      for (const data of parsed) {
        if (!data?.id) continue
        const cronJob = new CronJob(data)
        this.items.set(cronJob.id, cronJob)
      }
      this.enforceLimit()
    } catch (err) {
      logger.warn(`Failed to load ${file}:`, err)
    }
  }

  private persist(): void {
    const file = this.filePath()
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true })
      const data = [...this.items.values()].map((c) => c['data'] as ICronJobData)
      fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8')
    } catch (err) {
      logger.warn(`Failed to persist ${file}:`, err)
    }
  }
}
