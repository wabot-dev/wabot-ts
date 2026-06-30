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
import { ExpressProvider } from '@/feature/express'
import {
  runUiControllers,
  UiRendererRegistry,
  IslandRegistry,
  IRegisterUiControllersOptions,
} from '@/feature/ui-controller'
import { ControllerMetadataStore } from '@/feature/chat-controller/metadata'
import { RestControllerMetadataStore } from '@/feature/rest-controller/metadata'
import { SocketControllerMetadataStore } from '@/feature/socket-controller/metadata'
import { UiControllerMetadataStore } from '@/feature/ui-controller/metadata'
import {
  MemoryRepositoryAdapter,
  RepositoryAdapterRegistry,
  RepositoryMetadataStore,
} from '@/feature/repository'
import { scanProjectFiles } from './scanner'

export interface IProjectRunnerConfig {
  directories?: string[]
  exclude?: string[]
  connectionString?: string
  chatAdapters?: IConstructor<IChatAdapter>[]
  /**
   * When true, skip filesystem discovery (no readdir, no dynamic import of
   * source files) and start directly from the metadata that was registered
   * during the host module's import-time side effects.
   *
   * The caller is responsible for having imported every module that registers
   * controllers, handlers, adapters, etc. before invoking run(). This is the
   * mode used by the bundled output produced by src/build/build.ts.
   */
  preloaded?: boolean
  /** UI / island bundling options. */
  ui?: IUiRunnerConfig
}

export interface IUiRunnerConfig {
  /**
   * Extra esbuild import aliases for the island client bundler. Only needed when
   * islands import the framework UI through a non-package specifier (e.g. a path
   * alias in monorepo / in-repo dev). Regular consumers don't need this: the
   * package's "browser" export condition resolves the client build automatically.
   */
  bundlerAlias?: Record<string, string>
}

const logger = new Logger('wabot:project-runner')

type DefaultAdapterKey = 'openai' | 'openrouter' | 'anthropic' | 'google'

const DEFAULT_ADAPTER_LOADERS: Record<
  DefaultAdapterKey,
  { apiKeyEnv: string; load: () => Promise<IConstructor<IChatAdapter> | null> }
> = {
  openai: {
    apiKeyEnv: 'OPENAI_API_KEY',
    load: async () =>
      (await import('../../addon/chat-bot/openia/OpenaiChatAdapter')).OpenaiChatAdapter,
  },
  openrouter: {
    apiKeyEnv: 'OPENROUTER_API_KEY',
    load: async () =>
      (await import('../../addon/chat-bot/openrouter/OpenRouterChatAdapter')).OpenRouterChatAdapter,
  },
  anthropic: {
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    load: async () =>
      (await import('../../addon/chat-bot/anthropic/AnthropicChatAdapter')).AnthropicChatAdapter,
  },
  google: {
    apiKeyEnv: 'GOOGLE_API_KEY',
    load: async () =>
      (await import('../../addon/chat-bot/google/GoogleChatAdapter')).GoogleChatAdapter,
  },
}

interface DiscoveredComponents {
  chatControllers: IConstructor<any>[]
  restControllers: IConstructor<any>[]
  commandHandlers: IConstructor<ICommandHandler<any>>[]
  cronHandlers: IConstructor<ICronHandler>[]
  socketControllers: IConstructor<any>[]
  uiControllers: IConstructor<any>[]
}

export class ProjectRunner {
  private directories: string[]
  private exclude: string[]
  private chatAdapters: IConstructor<IChatAdapter>[] | undefined
  private connectionString: string | null
  private isPg: boolean
  private preloaded: boolean
  private ui: IUiRunnerConfig
  private pool: Pool | null = null

  constructor(config: IProjectRunnerConfig = {}) {
    this.directories = config.directories ?? ['src']
    this.exclude = config.exclude ?? []
    this.chatAdapters = config.chatAdapters
    this.connectionString = this.resolveConnectionString(config.connectionString)
    this.isPg = this.connectionString != null && isPostgresUrl(this.connectionString)
    this.preloaded = config.preloaded === true
    this.ui = config.ui ?? {}
  }

  async run(): Promise<void> {
    let scannedFiles: string[] = []
    if (this.preloaded) {
      if (this.isPg) await this.initPool()
    } else {
      const [, files] = await Promise.all([
        this.isPg ? this.initPool() : Promise.resolve(),
        scanProjectFiles({ directories: this.directories, exclude: this.exclude }),
      ])
      scannedFiles = files as string[]
      await this.importFiles(scannedFiles)
    }

    const components = this.discoverComponents()

    await this.registerAdapters(components)
    await this.startComponents(components, scannedFiles)
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

  private async importFiles(files: string[]): Promise<void> {
    if (files.length === 0) {
      logger.info('No files to import')
      return
    }

    const results = await Promise.allSettled(files.map((file) => import(pathToFileURL(file).href)))

    let imported = 0
    let failed = 0
    const errorGroups = new Map<string, string[]>()
    for (let i = 0; i < results.length; i++) {
      const result = results[i]
      if (result.status === 'fulfilled') {
        imported++
      } else {
        failed++
        const message = (result.reason as Error).message
        const group = errorGroups.get(message)
        if (group) {
          group.push(files[i])
        } else {
          errorGroups.set(message, [files[i]])
        }
      }
    }
    for (const [message, affected] of errorGroups) {
      const [first, ...rest] = affected
      const suffix = rest.length > 0 ? ` (also affects ${rest.length} more file(s))` : ''
      logger.error(`Failed to import ${first}: ${message}${suffix}`)
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
      uiControllers: container.resolve(UiControllerMetadataStore).getAllUiControllerConstructors(),
    }
  }

  private registerAdapters(components: DiscoveredComponents): Promise<void> {
    return this.isPg
      ? this.registerPostgresAdapters(components)
      : this.registerMemoryAdapters(components)
  }

  private async registerMemoryAdapters(components: DiscoveredComponents): Promise<void> {
    const needsJobs = components.commandHandlers.length > 0 || components.cronHandlers.length > 0

    const [chatBotMod, lockMod, jobMod, cronJobMod] = await Promise.all([
      import('../../addon/chat-bot/in-memory/InMemoryChatRepository'),
      import('../../addon/lock/InMemoryLocker'),
      needsJobs
        ? import('../../addon/async/in-memory/InMemoryJobRepository')
        : Promise.resolve(null),
      components.cronHandlers.length > 0
        ? import('../../addon/async/in-memory/InMemoryCronJobRepository')
        : Promise.resolve(null),
    ])

    container.register(ChatRepository, { useToken: chatBotMod.InMemoryChatRepository as any })
    container.register(Locker, { useToken: lockMod.InMemoryLocker as any })
    const memoryAdapter = new MemoryRepositoryAdapter()
    container.resolve(RepositoryAdapterRegistry).setDefault(memoryAdapter)
    container.resolve(RepositoryMetadataStore).validateExtensionsRegistered(memoryAdapter.id)

    if (jobMod) {
      container.register(JobRepository, { useToken: jobMod.InMemoryJobRepository as any })
    }
    if (cronJobMod) {
      container.register(CronJobRepository, {
        useToken: cronJobMod.InMemoryCronJobRepository as any,
      })
    }

    logger.info('Configured with in-memory adapters')
  }

  private async registerPostgresAdapters(components: DiscoveredComponents): Promise<void> {
    if (!this.pool) {
      throw new Error('Postgres pool was not initialized')
    }

    const hasCommandHandlers = components.commandHandlers.length > 0
    const hasCronHandlers = components.cronHandlers.length > 0

    const [chatBotMod, lockerMod, repoAdapterMod, txMod, jobMod, cronJobMod] = await Promise.all([
      import('../../addon/chat-bot/pg/PgChatRepository'),
      import('../../feature/pg/PgLocker'),
      import('../../feature/pg/PgJsonRepositoryAdapter'),
      import('../../addon/async/pg/PgTransactionAdapter'),
      hasCommandHandlers || hasCronHandlers
        ? import('../../addon/async/pg/PgJobRepository')
        : Promise.resolve(null),
      hasCronHandlers ? import('../../addon/async/pg/PgCronJobRepository') : Promise.resolve(null),
    ])

    container.register(ChatRepository, { useToken: chatBotMod.PgChatRepository as any })
    container.register(Locker, { useToken: lockerMod.PgLocker as any })
    const pgAdapter = new repoAdapterMod.PgJsonRepositoryAdapter(this.pool)
    container.resolve(RepositoryAdapterRegistry).setDefault(pgAdapter)
    container.resolve(RepositoryMetadataStore).validateExtensionsRegistered(pgAdapter.id)

    const transactionStore = container.resolve(TransactionMetadataStore)
    transactionStore.registerAdapter('default', new txMod.PgTransactionAdapter(this.pool))

    if (jobMod) {
      container.register(JobRepository, { useToken: jobMod.PgJobRepository })
    }
    if (cronJobMod) {
      container.register(CronJobRepository, { useToken: cronJobMod.PgCronJobRepository })
    }

    logger.info('Configured with PostgreSQL adapters')
  }

  private async startComponents(
    components: DiscoveredComponents,
    files: string[] = [],
  ): Promise<void> {
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

    if (components.uiControllers.length > 0) {
      await this.startUiControllers(components.uiControllers, files)
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

  private async startUiControllers(
    uiControllers: IConstructor<any>[],
    files: string[],
  ): Promise<void> {
    const rendererRegistry = container.resolve(UiRendererRegistry)
    if (!rendererRegistry.hasDefault()) {
      const { PreactRenderer } = await import('../../addon/ui/preact/PreactRenderer')
      rendererRegistry.setDefault(new PreactRenderer())
    }

    const client = rendererRegistry.get().client
    let pageAssets: IRegisterUiControllersOptions['pageAssets'] | undefined

    if (client) {
      // The bundler pulls in esbuild, so only load it when UI islands are in play.
      const bundlerMod = await import('../ui-controller/bundler/index')
      pageAssets = this.preloaded
        ? await this.setupProdUiAssets(bundlerMod)
        : await this.setupDevUiAssets(bundlerMod, client, files)
    }

    logger.info(`Starting ${uiControllers.length} UI controller(s)`)
    runUiControllers(uiControllers, { pageAssets })
  }

  private async setupDevUiAssets(
    bundlerMod: typeof import('../ui-controller/bundler/index'),
    client: NonNullable<ReturnType<UiRendererRegistry['get']>['client']>,
    files: string[],
  ): Promise<IRegisterUiControllersOptions['pageAssets'] | undefined> {
    const islands = await container.resolve(IslandRegistry).discover(files)
    if (islands.length === 0) return undefined

    const bundler = new bundlerMod.UiBundler({ islands, client, alias: this.ui.bundlerAlias })
    await bundler.startDev()
    bundlerMod.mountUiDevAssets(container.resolve(ExpressProvider).getExpress(), bundler)

    return (used) =>
      bundlerMod.pageAssetsFromManifest(bundler.getManifest(), used, {
        liveReloadPath: '/_wabot/livereload',
      })
  }

  private async setupProdUiAssets(
    bundlerMod: typeof import('../ui-controller/bundler/index'),
  ): Promise<IRegisterUiControllersOptions['pageAssets'] | undefined> {
    const fs = await import('node:fs')
    const nodePath = await import('node:path')
    const distUi = nodePath.resolve(process.cwd(), 'dist/ui')
    const manifestPath = nodePath.join(distUi, 'manifest.json')
    if (!fs.existsSync(manifestPath)) {
      logger.warn(`UI manifest not found at ${manifestPath}; islands will not hydrate`)
      return undefined
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
    const { default: express } = await import('express')
    container.resolve(ExpressProvider).getExpress().use('/_wabot', express.static(distUi))

    return (used) => bundlerMod.pageAssetsFromManifest(manifest, used)
  }

  private async resolveDefaultChatAdapters(): Promise<IConstructor<IChatAdapter>[]> {
    const keys = Object.keys(DEFAULT_ADAPTER_LOADERS) as DefaultAdapterKey[]
    const emptyKeys: string[] = []
    const results = await Promise.all(
      keys.map(async (key) => {
        const { apiKeyEnv, load } = DEFAULT_ADAPTER_LOADERS[key]
        const value = process.env[apiKeyEnv]
        if (value === undefined) return null
        if (value.trim() === '') {
          emptyKeys.push(apiKeyEnv)
          return null
        }
        try {
          const adapter = await load()
          if (!adapter) return null
          logger.info(`Using ${adapter.name}`)
          return adapter
        } catch {
          return null
        }
      }),
    )
    if (emptyKeys.length > 0) {
      throw new Error(
        `Chat adapter API key(s) defined but empty: ${emptyKeys.join(', ')}. ` +
          `Set a value in your .env or remove the variable entirely.`,
      )
    }
    return results.filter((a): a is IConstructor<IChatAdapter> => a != null)
  }
}

export function run(config?: IProjectRunnerConfig): Promise<void> {
  return new ProjectRunner(config).run()
}

function isPostgresUrl(cs: string): boolean {
  return cs.startsWith('postgres://') || cs.startsWith('postgresql://')
}
