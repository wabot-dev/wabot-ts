import * as fs from 'node:fs'
import * as path from 'node:path'
import { generate as generateShortUuid } from 'short-uuid'

import { Entity, IEntityData } from '@/core/entity'
import { CustomError } from '@/core/error'
import { IConstructor } from '@/core/generics'
import { Logger } from '@/core/logger'
import { evaluateQueryAst } from './evaluateQueryAst'
import { IRepositoryAdapter } from './IRepositoryAdapter'
import { IRepositoryConfig } from './IRepositoryConfig'
import { IRepositoryRuntime } from './IRepositoryRuntime'
import { IQueryAst } from './types'

const DEFAULT_PERSIST_DIR = '.wabot/in-memory'
const DEFAULT_MAX_ITEMS = 32

const logger = new Logger('wabot:memory-repository-adapter')

export interface IMemoryRepositoryAdapterOptions {
  persist?: boolean
  dir?: string
  maxItems?: number
}

function cloneEntity<P extends Entity<IEntityData>>(
  config: IRepositoryConfig<P>,
  item: P,
): P {
  const data = JSON.parse(JSON.stringify(item['data']))
  return new config.constructor(data)
}

interface IPersistOptions {
  enabled: boolean
  dir: string
  maxItems: number
}

class MemoryStore<P extends Entity<IEntityData>> {
  // Insertion order acts as LRU: most-recently-touched at the end.
  readonly items = new Map<string, P>()

  constructor(
    private readonly config: IRepositoryConfig<P>,
    private readonly persistOptions: IPersistOptions,
  ) {
    this.load()
  }

  touch(item: P): void {
    this.items.delete(item.id)
    this.items.set(item.id, item)
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
  constructor(
    private readonly store: MemoryStore<P>,
    private readonly config: IRepositoryConfig<P>,
  ) {}

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
    item['data'].id = generateShortUuid()
    item['data'].createdAt = new Date().getTime()
    item.validate()
    const stored = cloneEntity(this.config, item)
    this.store.touch(stored)
    this.store.enforceLimit()
    this.store.persist()
  }

  async update(item: P): Promise<void> {
    item.validate()
    if (!this.items.has(item.id)) {
      throw new Error(`Update failed: no affected rows`)
    }
    this.store.touch(cloneEntity(this.config, item))
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

  private getStore<P extends Entity<IEntityData>>(
    config: IRepositoryConfig<P>,
  ): MemoryStore<P> {
    let store = this.stores.get(config)
    if (!store) {
      store = new MemoryStore<P>(config, this.persistOptions)
      this.stores.set(config, store)
    }
    return store as MemoryStore<P>
  }

  build<P extends Entity<IEntityData>>(config: IRepositoryConfig<P>): IRepositoryRuntime<P> {
    return new MemoryRepositoryRuntime(this.getStore(config), config)
  }

  buildExtension<E>(config: IRepositoryConfig<any>, ExtensionCtor: IConstructor<E>): E {
    return new ExtensionCtor(this.getStore(config).items, config)
  }
}
