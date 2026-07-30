import * as fs from 'node:fs'
import * as path from 'node:path'

import { Entity, IEntityData } from '@/core/entity'
import { CustomError } from '@/core/error'
import { IConstructor } from '@/core/generics'
import { Logger } from '@/core/logger'
import { evaluateQueryAst } from './evaluateQueryAst'
import { resolveIdStrategy, type IResolvedIdStrategy } from './idStrategy'
import { IRepositoryAdapter } from './IRepositoryAdapter'
import { IRepositoryConfig } from './IRepositoryConfig'
import { IRepositoryRuntime } from './IRepositoryRuntime'
import { IPage, IPageOptions, pageInMemory } from './pagination'
import { IQueryAst, IQueryCondition } from './types'

const DEFAULT_PERSIST_DIR = '.wabot/in-memory'
const DEFAULT_MAX_ITEMS = 32

const logger = new Logger('wabot:memory-repository-adapter')

export interface IMemoryRepositoryAdapterOptions {
  persist?: boolean
  dir?: string
  maxItems?: number
}

/**
 * Drop everything outside `config.fields`, so a projection hides the same
 * fields here as it does on a real database. Without a projection the data is
 * passed through untouched.
 */
function projectData(config: IRepositoryConfig<any>, data: any): any {
  const fields = config.fields as string[] | undefined
  if (!fields?.length) return data
  const projected: any = { id: data.id, createdAt: data.createdAt }
  for (const field of fields) {
    if (field in data) projected[field] = data[field]
  }
  return projected
}

function cloneEntity<P extends Entity<IEntityData>>(config: IRepositoryConfig<P>, item: P): P {
  const data = JSON.parse(JSON.stringify(item['data']))
  return new config.constructor(projectData(config, data))
}

/**
 * The stored entity with the projected fields overwritten. An UPDATE names only
 * the projected columns and leaves the rest of the row alone, so replacing the
 * whole record here would make memory lose data a database would have kept.
 */
function mergeProjected<P extends Entity<IEntityData>>(
  config: IRepositoryConfig<P>,
  stored: P,
  incoming: P,
): P {
  const fields = config.fields as string[] | undefined
  if (!fields?.length) return cloneEntity(config, incoming)
  const merged = JSON.parse(JSON.stringify(stored['data']))
  const source = incoming['data'] as Record<string, unknown>
  for (const field of fields) {
    if (field in source) merged[field] = JSON.parse(JSON.stringify(source[field] ?? null))
  }
  return new config.constructor(merged)
}

interface IPersistOptions {
  enabled: boolean
  dir: string
  maxItems: number
}

/**
 * Stand-ins for real database sequences, by name. Shared across stores because
 * the sequences they replace are: two repositories drawing from one sequence
 * must not be handed the same number here either.
 */
const namedSequences = new Map<string, number>()

class MemoryStore<P extends Entity<IEntityData>> {
  // Insertion order acts as LRU: most-recently-touched at the end.
  readonly items = new Map<string, P>()
  /** Highest numeric id this store has seen — the unnamed, per-table sequence. */
  private sequence = 0
  /** Set when the repository draws ids from a named sequence. */
  private sequenceName?: string

  constructor(
    private readonly config: IRepositoryConfig<P>,
    private readonly persistOptions: IPersistOptions,
  ) {
    this.load()
  }

  touch(item: P): void {
    this.items.delete(item.id)
    this.items.set(item.id, item)
    this.noteId(item.id)
  }

  /** Draw this store's ids from the shared counter standing in for `name`. */
  useSequence(name: string): void {
    this.sequenceName = name
    if (!namedSequences.has(name)) namedSequences.set(name, 0)
    // Rows already in the store (loaded from disk) came from that sequence too.
    this.noteId(String(this.sequence))
  }

  /**
   * The id a database-assigned repository would get for the next row. Numeric
   * and monotonic like a `bigserial`, and never reuses one a deleted row had.
   */
  nextSequenceId(): string {
    if (this.sequenceName === undefined) return String(this.sequence + 1)
    const next = (namedSequences.get(this.sequenceName) ?? 0) + 1
    namedSequences.set(this.sequenceName, next)
    return String(next)
  }

  /** Keep the sequence ahead of every id the store has seen, however it arrived. */
  private noteId(id: string): void {
    if (!/^\d+$/.test(id)) return
    const value = Number(id)
    if (!Number.isSafeInteger(value)) return
    if (value > this.sequence) this.sequence = value
    if (this.sequenceName !== undefined && value > (namedSequences.get(this.sequenceName) ?? 0)) {
      namedSequences.set(this.sequenceName, value)
    }
  }

  enforceLimit(): void {
    while (this.items.size > this.persistOptions.maxItems) {
      const oldest = this.items.keys().next().value
      if (oldest === undefined) break
      this.items.delete(oldest)
    }
  }

  persist(): void {
    if (!this.persistOptions.enabled) return
    const file = this.filePath()
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true })
      const data = [...this.items.values()].map((i) => i['data'])
      fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8')
    } catch (err) {
      logger.warn(`Failed to persist ${file}:`, err)
    }
  }

  private load(): void {
    if (!this.persistOptions.enabled) return
    const file = this.filePath()
    if (!fs.existsSync(file)) return
    try {
      const raw = fs.readFileSync(file, 'utf-8')
      const parsed = JSON.parse(raw) as IEntityData[]
      if (!Array.isArray(parsed)) return
      for (const data of parsed) {
        if (!data?.id) continue
        const item = new this.config.constructor(data as any)
        this.items.set(data.id, item)
        this.noteId(data.id)
      }
      this.enforceLimit()
    } catch (err) {
      logger.warn(`Failed to load ${file}:`, err)
    }
  }

  private filePath(): string {
    return path.resolve(process.cwd(), this.persistOptions.dir, `${this.config.table}.json`)
  }
}

export class MemoryRepositoryExtension<P extends Entity<IEntityData>> {
  constructor(
    protected readonly items: Map<string, P>,
    protected readonly config: IRepositoryConfig<P>,
  ) {}

  protected clone(item: P): P {
    return cloneEntity(this.config, item)
  }
}

class MemoryRepositoryRuntime<P extends Entity<IEntityData>> implements IRepositoryRuntime<P> {
  private readonly idStrategy: IResolvedIdStrategy<P>

  constructor(
    private readonly store: MemoryStore<P>,
    private readonly config: IRepositoryConfig<P>,
  ) {
    // A database-assigned id is served from the store's own sequence, and a
    // named one from the counter standing in for that sequence — so a
    // repository over a `bigserial` table behaves the same with no database.
    this.idStrategy = resolveIdStrategy<P>(config.id, { label: config.table })
    if (this.idStrategy.kind === 'sequence') store.useSequence(this.idStrategy.sequence)
  }

  private get items(): Map<string, P> {
    return this.store.items
  }

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
    item['data'].id =
      this.idStrategy.kind === 'generated'
        ? await this.idStrategy.next(item)
        : this.store.nextSequenceId()
    item['data'].createdAt = new Date().getTime()
    item.validate()
    const stored = cloneEntity(this.config, item)
    this.store.touch(stored)
    this.store.enforceLimit()
    this.store.persist()
  }

  async restore(item: P): Promise<void> {
    item.validate()
    this.store.touch(cloneEntity(this.config, item))
    this.store.enforceLimit()
    this.store.persist()
  }

  async update(item: P): Promise<void> {
    item.validate()
    const stored = this.items.get(item.id)
    if (!stored) {
      throw new Error(`Update failed: no affected rows`)
    }
    this.store.touch(mergeProjected(this.config, stored, item))
    this.store.persist()
  }

  async delete(item: P): Promise<void> {
    this.items.delete(item.id)
    this.store.persist()
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
    if (matched.length > 0) this.store.persist()
  }

  async runPage(
    conditions: IQueryCondition[],
    args: unknown[],
    options: IPageOptions,
  ): Promise<IPage<P>> {
    const ast: IQueryAst = { prefix: 'find', conditions, orderBy: [] }
    const matched = evaluateQueryAst(this.items.values(), ast, args)
    const page = pageInMemory(matched, options)
    return {
      items: page.items.map((i) => cloneEntity(this.config, i)),
      nextCursor: page.nextCursor,
    }
  }
}

export const MEMORY_ADAPTER_ID = Symbol('wabot:memory-adapter')

export class MemoryRepositoryAdapter implements IRepositoryAdapter {
  readonly id = MEMORY_ADAPTER_ID

  private stores = new Map<unknown, MemoryStore<any>>()
  private readonly persistOptions: IPersistOptions

  constructor(options: IMemoryRepositoryAdapterOptions = {}) {
    this.persistOptions = {
      enabled: options.persist ?? true,
      dir: options.dir ?? DEFAULT_PERSIST_DIR,
      maxItems: options.maxItems ?? DEFAULT_MAX_ITEMS,
    }
  }

  private getStore<P extends Entity<IEntityData>>(config: IRepositoryConfig<P>): MemoryStore<P> {
    let store = this.stores.get(config)
    if (!store) {
      store = new MemoryStore<P>(config, this.persistOptions)
      this.stores.set(config, store)
    }
    return store as MemoryStore<P>
  }

  // Memory has a single strategy, so the extension ctor is not needed here.
  build<P extends Entity<IEntityData>>(config: IRepositoryConfig<P>): IRepositoryRuntime<P> {
    return new MemoryRepositoryRuntime(this.getStore(config), config)
  }

  buildExtension<E>(config: IRepositoryConfig<any>, ExtensionCtor: IConstructor<E>): E {
    return new ExtensionCtor(this.getStore(config).items, config)
  }
}
