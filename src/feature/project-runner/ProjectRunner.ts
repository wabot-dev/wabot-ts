import { readdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { Pool } from 'pg'
import { container } from '@/core/injection'
import { Logger } from '@/core/logger'
import { IConstructor } from '@/core/generics'
import { Locker } from '@/core/lock'
import { ChatRepository, IChatAdapter, runChatAdapters } from '@/feature/chat-bot'
import { runChatControllers } from '@/feature/chat-controller'
import { runRestControllers } from '@/feature/rest-controller'
import {
  runCommandHandlers,
  runCronHandlers,
  AsyncMetadataStore,
  TransactionMetadataStore,
  ICommandHandler,
  ICronHandler,
  JobRepository,
  CronJobRepository,
} from '@/feature/async'
import { runSocketControllers } from '@/feature/socket-controller'
import { ControllerMetadataStore } from '@/feature/chat-controller/metadata'
import { RestControllerMetadataStore } from '@/feature/rest-controller/metadata'
import { SocketControllerMetadataStore } from '@/feature/socket-controller/metadata'

export interface IProjectRunnerConfig {
  directories?: string[]
  connectionString?: string
  chatAdapters?: IConstructor<IChatAdapter>[]
}

const logger = new Logger('wabot:project-runner')
const TEST_FILE_PATTERNS = /\.(test|spec|unit|integration|e2e|multiprocess)\.(ts|js)$/

const DEFAULT_CHAT_ADAPTERS = [
  ['../../addon/chat-bot/openia', 'OpenaiChatAdapter'],
  ['../../addon/chat-bot/openrouter', 'OpenRouterChatAdapter'],
  ['../../addon/chat-bot/anthropic', 'AnthropicChatAdapter'],
  ['../../addon/chat-bot/google', 'GoogleChatAdapter'],
] as const

interface DiscoveredComponents {
  chatControllers: IConstructor<any>[]
  restControllers: IConstructor<any>[]
  commandHandlers: IConstructor<ICommandHandler<any>>[]
  cronHandlers: IConstructor<ICronHandler>[]
  socketControllers: IConstructor<any>[]
}

export class ProjectRunner {
  private directories: string[]
  private chatAdapters: IConstructor<IChatAdapter>[] | undefined
  private connectionString: string | null
  private isPg: boolean
  private pool: Pool | null = null

  constructor(config: IProjectRunnerConfig = {}) {
    this.directories = config.directories ?? ['src']
    this.chatAdapters = config.chatAdapters
    this.connectionString = this.resolveConnectionString(config.connectionString)
    this.isPg = this.connectionString != null && isPostgresUrl(this.connectionString)
  }

  async run(): Promise<void> {
    const [, files] = await Promise.all([
      this.isPg ? this.initPool() : Promise.resolve(),
      this.scanDirectories(),
    ])

    await this.importFiles(files)

    const components = this.discoverComponents()

    await this.registerAdapters(components)
    await this.startComponents(components)
  }

  private resolveConnectionString(configValue: string | undefined): string | null {
    const cs = configValue ?? process.env.DATABASE_URL ?? null
    if (cs && !isPostgresUrl(cs)) {
      logger.warn(
        `connectionString "${cs}" does not match a known scheme (postgres://, postgresql://); falling back to in-memory adapters`,
      )
    }
    return cs
  }

  private async initPool(): Promise<void> {
    const { Pool } = await import('pg')
    this.pool = new Pool({ connectionString: this.connectionString! })
    container.registerInstance(Pool, this.pool)
  }

  private async scanDirectories(): Promise<string[]> {
    const seen = new Set<string>()
    const roots = this.directories
      .map((d) => resolve(d))
      .filter((d) => {
        if (seen.has(d)) return false
        seen.add(d)
        return true
      })

    const results = await Promise.all(
      roots.map((dir) =>
        scanDir(dir).catch((err: Error) => {
          logger.warn(`Could not read directory ${dir}: ${err.message}`)
          return [] as string[]
        }),
      ),
    )
    return results.flat()
  }

  private async importFiles(files: string[]): Promise<void> {
    if (files.length === 0) {
      logger.info('No files to import')
      return
    }

    const results = await Promise.allSettled(
      files.map((file) => import(pathToFileURL(file).href)),
    )

    let imported = 0
    let failed = 0
    for (let i = 0; i < results.length; i++) {
      const result = results[i]
      if (result.status === 'fulfilled') {
        imported++
      } else {
        failed++
        const reason = result.reason as Error
        logger.error(`Failed to import ${files[i]}: ${reason.message}`)
      }
    }

    if (failed > 0) {
      logger.warn(`Imported ${imported}/${files.length} files (${failed} failed)`)
    } else {
      logger.info(`Imported ${imported}/${files.length} files`)
    }
  }

  private discoverComponents(): DiscoveredComponents {
    const asyncStore = container.resolve(AsyncMetadataStore)
    return {
      chatControllers: container
        .resolve(ControllerMetadataStore)
        .getAllChatControllerConstructors() as IConstructor<any>[],
      restControllers: container
        .resolve(RestControllerMetadataStore)
        .getAllRestControllerConstructors(),
      commandHandlers: asyncStore.getAllCommandHandlers(),
      cronHandlers: asyncStore.getAllCronHandlers(),
      socketControllers: container
        .resolve(SocketControllerMetadataStore)
        .getAllSocketControllerConstructors(),
    }
  }

  private registerAdapters(components: DiscoveredComponents): Promise<void> {
    return this.isPg
      ? this.registerPostgresAdapters(components)
      : this.registerMemoryAdapters(components)
  }

  private async registerMemoryAdapters(components: DiscoveredComponents): Promise<void> {
    const needsJobs =
      components.commandHandlers.length > 0 || components.cronHandlers.length > 0

    const [chatBotMod, lockMod, asyncMod] = await Promise.all([
      import('../../addon/chat-bot/in-memory'),
      import('../../addon/lock'),
      needsJobs ? import('../../addon/async/in-memory') : Promise.resolve(null),
    ])

    container.registerType(ChatRepository, chatBotMod.InMemoryChatRepository as any)
    container.registerType(Locker, lockMod.InMemoryLocker as any)

    if (asyncMod) {
      container.registerType(JobRepository, asyncMod.InMemoryJobRepository as any)
      if (components.cronHandlers.length > 0) {
        container.registerType(CronJobRepository, asyncMod.InMemoryCronJobRepository as any)
      }
    }

    logger.info('Configured with in-memory adapters')
  }

  private async registerPostgresAdapters(components: DiscoveredComponents): Promise<void> {
    if (!this.pool) {
      throw new Error('Postgres pool was not initialized')
    }

    const [chatBotMod, pgMod, asyncMod] = await Promise.all([
      import('../../addon/chat-bot/pg'),
      import('../../feature/pg'),
      import('../../addon/async/pg'),
    ])

    container.registerType(ChatRepository, chatBotMod.PgChatRepository as any)
    container.registerType(Locker, pgMod.PgLocker as any)

    const transactionStore = container.resolve(TransactionMetadataStore)
    transactionStore.registerAdapter('default', new asyncMod.PgTransactionAdapter(this.pool))

    const hasCommandHandlers = components.commandHandlers.length > 0
    const hasCronHandlers = components.cronHandlers.length > 0

    if (hasCommandHandlers || hasCronHandlers) {
      container.registerType(JobRepository, asyncMod.PgJobRepository)
    }
    if (hasCronHandlers) {
      container.registerType(CronJobRepository, asyncMod.PgCronJobRepository)
    }

    logger.info('Configured with PostgreSQL adapters')
  }

  private async startComponents(components: DiscoveredComponents): Promise<void> {
    const chatAdapters = this.chatAdapters ?? (await this.resolveDefaultChatAdapters())
    if (chatAdapters.length > 0) {
      runChatAdapters(chatAdapters)
    }

    if (components.chatControllers.length > 0) {
      logger.info(`Starting ${components.chatControllers.length} chat controller(s)`)
      runChatControllers(components.chatControllers)
    }

    if (components.restControllers.length > 0) {
      logger.info(`Starting ${components.restControllers.length} REST controller(s)`)
      runRestControllers(components.restControllers)
    }

    if (components.commandHandlers.length > 0) {
      logger.info(`Starting ${components.commandHandlers.length} command handler(s)`)
      runCommandHandlers(components.commandHandlers)
    }

    if (components.cronHandlers.length > 0) {
      logger.info(`Starting ${components.cronHandlers.length} cron handler(s)`)
      runCronHandlers(components.cronHandlers)
    }

    if (components.socketControllers.length > 0) {
      logger.info(`Starting ${components.socketControllers.length} socket controller(s)`)
      runSocketControllers(components.socketControllers)
    }
  }

  private async resolveDefaultChatAdapters(): Promise<IConstructor<IChatAdapter>[]> {
    const results = await Promise.all(
      DEFAULT_CHAT_ADAPTERS.map(async ([path, name]) => {
        try {
          const mod: any = await import(path)
          const adapter = mod[name]
          if (!adapter) {
            logger.warn(`Skipping ${name}: module loaded but no '${name}' export found`)
            return null
          }
          return adapter as IConstructor<IChatAdapter>
        } catch {
          logger.warn(`Skipping ${name}: missing peer dependency`)
          return null
        }
      }),
    )
    return results.filter((a): a is IConstructor<IChatAdapter> => a != null)
  }
}

export function run(config?: IProjectRunnerConfig): Promise<void> {
  return new ProjectRunner(config).run()
}

function isPostgresUrl(cs: string): boolean {
  return cs.startsWith('postgres://') || cs.startsWith('postgresql://')
}

async function scanDir(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const subResults = await Promise.all(
    entries.map(async (entry) => {
      const name = entry.name
      if (entry.isDirectory()) {
        if (name.startsWith('__')) return []
        return scanDir(join(dir, name))
      }
      if (!entry.isFile()) return []
      if (!(name.endsWith('.ts') || name.endsWith('.js'))) return []
      if (name.endsWith('.d.ts')) return []
      const fullPath = join(dir, name)
      if (TEST_FILE_PATTERNS.test(fullPath)) return []
      return [fullPath]
    }),
  )
  return subResults.flat()
}
