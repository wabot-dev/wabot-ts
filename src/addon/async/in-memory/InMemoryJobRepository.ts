import * as fs from 'node:fs'
import * as path from 'node:path'
import { generate as generateShortUuid } from 'short-uuid'
import { singleton } from '@/core/injection'
import { Logger } from '@/core/logger'
import { Job, type IJobData, type IJobRepository } from '@/feature/async'

const JOBS_FILE = '.wabot/in-memory/jobs.json'
const MAX_JOBS = 32

const logger = new Logger('wabot:in-memory-job-repository')

@singleton()
export class InMemoryJobRepository implements IJobRepository {
  // Insertion order acts as LRU: most-recently-touched at the end.
  private items = new Map<string, Job>()

  constructor() {
    this.load()
  }

  async find(id: string): Promise<Job | null> {
    return this.items.get(id) ?? null
  }

  async findOrThrow(id: string): Promise<Job> {
    const item = this.items.get(id)
    if (!item) throw new Error(`Job with id = '${id}' not found`)
    return item
  }

  async findByIds(ids: string[]): Promise<Job[]> {
    return ids.map((id) => this.items.get(id)).filter((j): j is Job => j != null)
  }

  async findAll(): Promise<Job[]> {
    return [...this.items.values()]
  }

  async create(item: Job): Promise<void> {
    if (item.wasCreated()) throw new Error('Job already created')
    item['data'].id = generateShortUuid()
    item['data'].createdAt = new Date().getTime()
    item.validate()
    this.items.set(item.id, item)
    this.enforceLimit()
    this.persist()
  }

  async update(item: Job): Promise<void> {
    if (!item.wasCreated()) throw new Error('Job was not created')
    item.validate()
    this.touch(item)
    this.persist()
  }

  async delete(item: Job): Promise<void> {
    this.items.delete(item.id)
    this.persist()
  }

  async findPendingForRunFrom(date: Date, limit: number): Promise<Job[]> {
    const now = date.getTime()
    return [...this.items.values()]
      .filter(
        (j) =>
          j['data'].scheduledAt != null &&
          j['data'].scheduledAt <= now &&
          j['data'].startedAt == null &&
          j['data'].successAt == null &&
          j['data'].failedAt == null,
      )
      .sort((a, b) => (a['data'].scheduledAt ?? 0) - (b['data'].scheduledAt ?? 0))
      .slice(0, limit)
  }

  async findRunningJobs(): Promise<Job[]> {
    return [...this.items.values()].filter((j) => {
      if (j['data'].successAt != null || j['data'].failedAt != null) return false
      return j['data'].scheduledAt != null && j['data'].startedAt != null
    })
  }

  async countRunningByCommand(commandName: string): Promise<number> {
    let count = 0
    for (const j of this.items.values()) {
      if (j['data'].commandName !== commandName) continue
      if (j['data'].successAt != null || j['data'].failedAt != null) continue
      if (j['data'].scheduledAt != null && j['data'].startedAt != null) {
        count++
      }
    }
    return count
  }

  private touch(item: Job): void {
    this.items.delete(item.id)
    this.items.set(item.id, item)
  }

  private enforceLimit(): void {
    while (this.items.size > MAX_JOBS) {
      const oldestKey = this.items.keys().next().value
      if (oldestKey === undefined) break
      this.items.delete(oldestKey)
    }
  }

  private filePath(): string {
    return path.resolve(process.cwd(), JOBS_FILE)
  }

  private load(): void {
    const file = this.filePath()
    if (!fs.existsSync(file)) return
    try {
      const raw = fs.readFileSync(file, 'utf-8')
      const parsed = JSON.parse(raw) as IJobData[]
      if (!Array.isArray(parsed)) return
      for (const data of parsed) {
        if (!data?.id) continue
        const job = new Job(data)
        this.items.set(job.id, job)
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
      const data = [...this.items.values()].map((j) => j['data'] as IJobData)
      fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8')
    } catch (err) {
      logger.warn(`Failed to persist ${file}:`, err)
    }
  }
}
