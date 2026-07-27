import { pathToFileURL } from 'node:url'
import type { Pool } from 'pg'
import { container } from '@/core/injection'
import { Logger } from '@/core/logger'
import { Env } from '@/core/env'
import { ConfigError, findConfigError, formatConfigErrorReport } from '@/core/config'
import { IConstructor } from '@/core/generics'
import { Locker } from '@/core/lock'
import { Idempotency } from '@/core/idempotency'
import { RateLimiter } from '@/core/rate-limit'
import { initTelemetry } from '@/core/observability'
import { AuditLog } from '@/core/audit'
import { setupCrashHandlers, ShutdownManager } from '@/core/lifecycle'
import { buildPgPoolConfig, trackPgPool } from '@/feature/pg'
import { IChatAdapter, runAudioAdapters, runChatAdapters } from '@/feature/chat-bot'
import { IChatChannel, runChatControllers, stopChatControllers } from '@/feature/chat-controller'
import { SocketServerProvider } from '@/feature/socket'
import { JobExecutor } from '@/feature/async/JobExecutor'
import {
  IRealtimeVoiceEngine,
  runRealtimeVoiceEngines,
  runVoiceControllers,
  VoiceControllerMetadataStore,
} from '@/feature/voice-call'
import { runRestControllers } from '@/feature/rest-controller'
import {
  runCommandHandlers,
  runCronHandlers,
  stopCommandHandlers,
  stopCronHandlers,
  AsyncMetadataStore,
  TransactionMetadataStore,
  ICommandHandler,
  ICronHandler,
} from '@/feature/async'
import { runSocketControllers } from '@/feature/socket-controller'
import { ExpressProvider } from '@/feature/express'
import { HttpServerProvider } from '@/feature/http'
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
  DbPoolMetadataStore,
  DefaultDbPool,
  IDbPoolOverrides,
  IDbPoolProvider,
  IRepositoryAdapter,
  MemoryRepositoryAdapter,
  normalizeAudit,
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
  /**
   * Override the default database. When set, its `@dbPool` provider sources the
   * connection for repositories that don't set `pool` (and for the framework's
   * non-repository services) — e.g. to fetch `DATABASE_URL` from a secret store.
   * A single value, so there is never more than one default. Omit to use
   * `DATABASE_URL`.
   */
  defaultDatabase?: IConstructor<IDbPoolProvider>
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
  voiceControllers: IConstructor<any>[]
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
  private additionalPools: { name: string; pool: Pool }[] = []
  private defaultDatabaseProvider?: IConstructor<IDbPoolProvider>
  private defaultPoolOverrides: IDbPoolOverrides = {}
  // Resolved pool per database provider, for routing audit streams to the right DB.
  private providerPools = new Map<IConstructor<IDbPoolProvider>, Pool>()

  constructor(config: IProjectRunnerConfig = {}) {
    this.directories = config.directories ?? ['src']
    this.exclude = config.exclude ?? []
    this.chatAdapters = config.chatAdapters
    this.connectionString = this.resolveConnectionString(config.connectionString)
    this.isPg = this.connectionString != null && isPostgresUrl(this.connectionString)
    this.preloaded = config.preloaded === true
    this.defaultDatabaseProvider = config.defaultDatabase
    this.ui = config.ui ?? {}
  }

  async run(): Promise<void> {
    // Install crash handlers first so a failure during boot is logged, reported
    // to the error monitor, and exits cleanly. Graceful (SIGTERM/SIGINT) drain
    // is wired later, once components are running (setupGracefulShutdown).
    setupCrashHandlers()

    // Load @opentelemetry/api if the app installed it, so spans/metrics and
    // trace-correlated logs light up. A no-op otherwise.
    await initTelemetry()

    // A custom default database provider (config.defaultDatabase) sources the
    // default connection — possibly async (a secret store) — so resolve it before
    // deciding Postgres vs in-memory.
    await this.resolveDefaultDatabase()

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
    await this.registerAdditionalDatabases()
    this.registerAuditStreams()
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

  private async resolveDefaultDatabase(): Promise<void> {
    const provider = this.defaultDatabaseProvider
    if (!provider) return
    if (!container.resolve(DbPoolMetadataStore).isProvider(provider)) {
      throw new Error(`config.defaultDatabase "${provider.name}" is missing the @dbPool decorator.`)
    }
    const instance = container.resolve(provider)
    this.connectionString = (await instance.connection()) || null
    this.isPg = this.connectionString != null && isPostgresUrl(this.connectionString)
    this.defaultPoolOverrides = instance.pool?.() ?? {}
  }

  private async initPool(): Promise<void> {
    const { Pool } = await import('pg')
    this.pool = new Pool(
      buildPgPoolConfig(this.connectionString!, container.resolve(Env), this.defaultPoolOverrides),
    )
    // An idle client can emit 'error' when its connection drops (network blip, DB
    // restart). Without a listener pg rethrows and crashes the process; log it and
    // let the pool discard and replace the client.
    this.pool.on('error', (err) => logger.error('pg pool idle client error', err))
    trackPgPool('default', this.pool)
    container.registerInstance(Pool, this.pool)
    this.providerPools.set(DefaultDbPool, this.pool)
    if (this.defaultDatabaseProvider)
      this.providerPools.set(this.defaultDatabaseProvider, this.pool)
  }

  /**
   * Wire the databases that repositories reference via `@repository({ pool })`,
   * beyond the default. Runs after imports so every `@repository` config is
   * known. Each distinct provider gets its own tuned pool (or an in-memory
   * fallback when its `connection()` is not Postgres), registered by provider
   * class so the repo resolves it. Guarantees providers are ready before any
   * repository is used.
   */
  /**
   * Route each audited repository's stream to the pool of its audit database
   * (defaulting to the repository's own data pool). Only the Postgres audit log
   * needs routing; the in-memory one has no pools.
   */
  private registerAuditStreams(): void {
    const auditLog = container.resolve(AuditLog) as {
      setStreamPool?: (stream: string, pool: Pool) => void
    }
    if (typeof auditLog.setStreamPool !== 'function') return
    for (const config of container.resolve(RepositoryMetadataStore).getAllConfigs()) {
      const audit = normalizeAudit(config)
      if (!audit) continue
      const pool = this.providerPools.get(audit.pool ?? DefaultDbPool)
      if (pool) auditLog.setStreamPool(audit.stream, pool)
    }
  }

  private async registerAdditionalDatabases(): Promise<void> {
    const metaStore = container.resolve(RepositoryMetadataStore)
    const poolStore = container.resolve(DbPoolMetadataStore)
    const registry = container.resolve(RepositoryAdapterRegistry)
    const env = container.resolve(Env)

    const providers = new Set<IConstructor<IDbPoolProvider>>()
    for (const config of metaStore.getAllConfigs()) {
      // Skip the default database — it (and a custom default provider) is already
      // wired by registerAdapters.
      if (
        config.pool &&
        config.pool !== DefaultDbPool &&
        config.pool !== this.defaultDatabaseProvider
      ) {
        providers.add(config.pool)
      }
    }
    if (providers.size === 0) return

    for (const providerCtor of providers) {
      const name = providerCtor.name
      if (!poolStore.isProvider(providerCtor)) {
        throw new Error(`Repository database provider "${name}" is missing the @dbPool decorator.`)
      }
      const provider = container.resolve(providerCtor)
      const connectionString = await provider.connection()

      let adapter: IRepositoryAdapter
      if (connectionString && isPostgresUrl(connectionString)) {
        const { Pool } = await import('pg')
        const { PgJsonRepositoryAdapter } = await import('../../feature/pg/PgJsonRepositoryAdapter')
        const poolConfig = buildPgPoolConfig(connectionString, env, {
          applicationName: `wabot:${name}`,
          ...(provider.pool?.() ?? {}),
        })
        const pool = new Pool(poolConfig)
        pool.on('error', (err) => logger.error(`pg pool idle client error [${name}]`, err))
        trackPgPool(name, pool)
        this.additionalPools.push({ name, pool })
        this.providerPools.set(providerCtor, pool)
        adapter = new PgJsonRepositoryAdapter(pool)
      } else {
        // No Postgres connection → this database uses its own in-memory store.
        adapter = new MemoryRepositoryAdapter()
        logger.warn(`Database "${name}" has no Postgres connection; using in-memory fallback`)
      }
      registry.register(providerCtor, adapter)
    }
    logger.info(`Configured ${providers.size} additional database(s)`)
  }

  private async importFiles(files: string[]): Promise<void> {
    if (files.length === 0) {
      logger.info('No files to import')
      return
    }

    const results = await Promise.allSettled(files.map((file) => import(pathToFileURL(file).href)))

    let imported = 0
    const configErrors: ConfigError[] = []
    const errorGroups = new Map<string, string[]>()
    for (let i = 0; i < results.length; i++) {
      const result = results[i]
      if (result.status === 'fulfilled') {
        imported++
        continue
      }
      const configError = findConfigError(result.reason)
      if (configError) {
        configErrors.push(configError)
        continue
      }
      const message = (result.reason as Error).message
      const group = errorGroups.get(message)
      if (group) {
        group.push(files[i])
      } else {
        errorGroups.set(message, [files[i]])
      }
    }
    for (const [message, affected] of errorGroups) {
      const [first, ...rest] = affected
      const suffix = rest.length > 0 ? ` (also affects ${rest.length} more file(s))` : ''
      logger.error(`Failed to import ${first}: ${message}${suffix}`)
    }

    // Fail fast: a declared config reference with no value is a real
    // misconfiguration (not an optional-dependency situation), so surface all of
    // them at boot instead of letting the misconfigured component vanish silently.
    if (configErrors.length > 0) {
      throw new Error(formatConfigErrorReport(configErrors))
    }

    const failed = results.length - imported
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
      voiceControllers: container
        .resolve(VoiceControllerMetadataStore)
        .getAllVoiceControllerConstructors() as IConstructor<any>[],
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

    // Repositories resolve through the adapter registry, so only their custom
    // queries need importing — each extension registers itself on import.
    const [lockMod, idempotencyMod, rateLimitMod, auditMod] = await Promise.all([
      import('../../addon/lock/InMemoryLocker'),
      import('../../addon/idempotency/InMemoryIdempotency'),
      import('../../addon/rate-limit/InMemoryRateLimiter'),
      import('../../addon/audit/InMemoryAuditLog'),
      import('../../addon/chat-bot/in-memory/index'),
      needsJobs ? import('../../addon/async/in-memory/index') : Promise.resolve(null),
    ])

    container.register(Locker, { useToken: lockMod.InMemoryLocker as any })
    container.register(Idempotency, { useToken: idempotencyMod.InMemoryIdempotency as any })
    container.register(RateLimiter, { useToken: rateLimitMod.InMemoryRateLimiter as any })
    container.register(AuditLog, { useToken: auditMod.InMemoryAuditLog as any })
    const memoryAdapter = new MemoryRepositoryAdapter()
    const registry = container.resolve(RepositoryAdapterRegistry)
    registry.setDefault(memoryAdapter)
    registry.register(DefaultDbPool, memoryAdapter)
    if (this.defaultDatabaseProvider) registry.register(this.defaultDatabaseProvider, memoryAdapter)
    // The memory backend runs no statements, so every projection needs its own
    // in-memory implementation — checked here rather than at the first call.
    container.resolve(RepositoryMetadataStore).validateExtensionsRegistered(memoryAdapter.id, false)

    logger.info('Configured with in-memory adapters')
  }

  private async registerPostgresAdapters(components: DiscoveredComponents): Promise<void> {
    if (!this.pool) {
      throw new Error('Postgres pool was not initialized')
    }

    const hasCommandHandlers = components.commandHandlers.length > 0
    const hasCronHandlers = components.cronHandlers.length > 0

    // Repositories resolve through the adapter registry, so only their custom
    // queries need importing — each extension registers itself on import.
    const [lockerMod, idempotencyMod, rateLimitMod, auditMod, repoAdapterMod, txMod] =
      await Promise.all([
        import('../../feature/pg/PgLocker'),
        import('../../feature/pg/PgIdempotency'),
        import('../../feature/pg/PgRateLimiter'),
        import('../../feature/pg/PgAuditLog'),
        import('../../feature/pg/PgJsonRepositoryAdapter'),
        import('../../addon/async/pg/PgTransactionAdapter'),
        import('../../addon/chat-bot/pg/index'),
        hasCommandHandlers || hasCronHandlers
          ? import('../../addon/async/pg/index')
          : Promise.resolve(null),
      ])

    container.register(Locker, { useToken: lockerMod.PgLocker as any })
    container.register(Idempotency, { useToken: idempotencyMod.PgIdempotency as any })
    container.register(RateLimiter, { useToken: rateLimitMod.PgRateLimiter as any })
    container.register(AuditLog, { useToken: auditMod.PgAuditLog as any })
    const pgAdapter = new repoAdapterMod.PgJsonRepositoryAdapter(this.pool)
    const registry = container.resolve(RepositoryAdapterRegistry)
    registry.setDefault(pgAdapter)
    registry.register(DefaultDbPool, pgAdapter)
    if (this.defaultDatabaseProvider) registry.register(this.defaultDatabaseProvider, pgAdapter)
    container.resolve(RepositoryMetadataStore).validateExtensionsRegistered(pgAdapter.id)

    const transactionStore = container.resolve(TransactionMetadataStore)
    transactionStore.registerAdapter('default', new txMod.PgTransactionAdapter(this.pool))

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

    // Audio adapters (voice-note STT/TTS) auto-load like chat adapters; which
    // models a bot uses is declared in its mindset models() (speechToText /
    // textToSpeech).
    if (components.chatControllers.length > 0) {
      const audioAdapters = await this.resolveDefaultAudioAdapters()
      if (audioAdapters.length > 0) {
        runAudioAdapters(audioAdapters)
      }
    }

    // Register everything (routes + Socket.IO namespaces) before the port opens,
    // so a client can never connect to a namespace that is not registered yet.
    const httpServerProvider = container.resolve(HttpServerProvider)
    httpServerProvider.deferListen()

    // A @socket chat channel (started by runChatControllers below) creates the
    // Socket.IO server. engine.io only delegates non-socket.io HTTP requests to
    // Express when Express is already attached to the shared http server at the
    // moment the Socket.IO server is created; otherwise both answer the same
    // request and long-polling crashes with ERR_HTTP_HEADERS_SENT. Attach Express
    // first whenever express-based controllers (UI/REST) are present.
    if (
      components.uiControllers.length > 0 ||
      components.restControllers.length > 0 ||
      components.voiceControllers.length > 0
    ) {
      container.resolve(ExpressProvider).getExpress()
    }

    let chatChannels: IChatChannel[] = []
    if (components.chatControllers.length > 0) {
      logger.info(`Starting ${components.chatControllers.length} chat controller(s)`)
      chatChannels = runChatControllers(components.chatControllers)
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

    if (components.voiceControllers.length > 0) {
      const voiceEngines = await this.resolveDefaultVoiceEngines()
      if (voiceEngines.length > 0) {
        runRealtimeVoiceEngines(voiceEngines)
      } else {
        logger.warn(
          'Voice controllers found but no realtime voice engine loaded (set OPENAI_API_KEY).',
        )
      }
      logger.info(`Starting ${components.voiceControllers.length} voice controller(s)`)
      runVoiceControllers(components.voiceControllers)
    }

    // All routes and namespaces are registered — now open the port.
    httpServerProvider.releaseListen()

    this.setupGracefulShutdown(components, chatChannels, httpServerProvider)
  }

  /**
   * Register shutdown tasks for everything that was started and install the
   * SIGTERM/SIGINT handlers. Ordered by phase: stop intake (channels, job/cron
   * pollers) → drain in-flight work (jobs, HTTP requests) → release resources
   * (socket server, DB pool). Only subsystems that are actually running are
   * registered, so an in-memory or channel-only app shuts down just as cleanly.
   */
  private setupGracefulShutdown(
    components: DiscoveredComponents,
    chatChannels: IChatChannel[],
    httpServerProvider: HttpServerProvider,
  ): void {
    const shutdown = container.resolve(ShutdownManager)

    // intake — stop accepting new work
    if (chatChannels.length > 0) {
      shutdown.register({
        name: 'chat-channels',
        phase: 'intake',
        run: () => stopChatControllers(chatChannels),
      })
    }
    if (components.commandHandlers.length > 0) {
      shutdown.register({
        name: 'command-handlers',
        phase: 'intake',
        run: () => stopCommandHandlers(components.commandHandlers),
      })
    }
    if (components.cronHandlers.length > 0) {
      shutdown.register({
        name: 'cron-handlers',
        phase: 'intake',
        run: () => stopCronHandlers(components.cronHandlers),
      })
    }

    // drain — let in-flight work finish
    if (components.commandHandlers.length > 0) {
      const drainMs =
        container.resolve(Env).requireNumber('WABOT_SHUTDOWN_TIMEOUT_SECONDS', { default: 30 }) *
        1000
      shutdown.register({
        name: 'drain-jobs',
        phase: 'drain',
        run: () => container.resolve(JobExecutor).drain(drainMs),
      })
    }

    // HTTP and Socket.IO share one server. When a socket server is active,
    // io.close() drains and closes the shared HTTP server too, so it owns the
    // HTTP shutdown; otherwise close the HTTP server directly.
    const socketProvider = container.resolve(SocketServerProvider)
    if (socketProvider.isActive()) {
      shutdown.register({
        name: 'socket-server',
        phase: 'drain',
        run: () => socketProvider.close(),
      })
    } else if (
      components.uiControllers.length > 0 ||
      components.restControllers.length > 0 ||
      components.voiceControllers.length > 0
    ) {
      shutdown.register({
        name: 'http-server',
        phase: 'drain',
        run: () => httpServerProvider.close(),
      })
    }

    // close — release resources
    if (this.pool) {
      const pool = this.pool
      shutdown.register({ name: 'pg-pool', phase: 'close', run: () => pool.end() })
    }
    for (const { name, pool } of this.additionalPools) {
      shutdown.register({ name: `pg-pool-${name}`, phase: 'close', run: () => pool.end() })
    }

    shutdown.installSignalHandlers()
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

    if (!this.preloaded) {
      this.printUiDevUrl(uiControllers)
    }
  }

  /** In dev, print a clickable link to the UI so it's one click away in the terminal. */
  private printUiDevUrl(uiControllers: IConstructor<any>[]): void {
    const store = container.resolve(UiControllerMetadataStore)
    let path = ''
    for (const controller of uiControllers) {
      const views = store.getControllerViewsInfo(controller)
      if (views.length > 0) {
        const base = views[0].controller.path.replace(/^\/+|\/+$/g, '')
        path = base ? `/${base}` : ''
        break
      }
    }
    const url = `http://localhost:${process.env.PORT || 3000}${path}`
    // OSC 8 hyperlink when attached to a terminal; the raw URL otherwise (most
    // terminals also linkify a bare URL).
    const link = process.stdout.isTTY ? `\u001b]8;;${url}\u0007${url}\u001b]8;;\u0007` : url
    console.log(`\n  →  Wabot UI running at  ${link}\n`)
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
    const devAssets = await bundlerMod.mountUiDevAssets(
      container.resolve(ExpressProvider).getExpress(),
      bundler,
    )
    container.resolve(ShutdownManager).register({
      name: 'ui-live-reload',
      phase: 'drain',
      run: () => devAssets.close(),
    })

    return (used) =>
      bundlerMod.pageAssetsFromManifest(bundler.getManifest(), used, {
        liveReloadPath: '/_wabot/livereload',
        liveReloadPort: devAssets.liveReloadPort,
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

  private async resolveDefaultAudioAdapters(): Promise<IConstructor<any>[]> {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey || apiKey.trim() === '') return []
    try {
      const [transcriberMod, synthMod] = await Promise.all([
        import('../../addon/chat-bot/openia/OpenaiAudioTranscriber'),
        import('../../addon/chat-bot/openia/OpenaiAudioSpeechSynthesizer'),
      ])
      return [transcriberMod.OpenaiAudioTranscriber, synthMod.OpenaiAudioSpeechSynthesizer]
    } catch {
      return []
    }
  }

  private async resolveDefaultVoiceEngines(): Promise<IConstructor<IRealtimeVoiceEngine>[]> {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey || apiKey.trim() === '') return []
    try {
      const { OpenaiRealtimeVoiceEngine } = await import(
        '../../addon/voice-call/openai/OpenaiRealtimeVoiceEngine'
      )
      logger.info(`Using ${OpenaiRealtimeVoiceEngine.name}`)
      return [OpenaiRealtimeVoiceEngine]
    } catch {
      return []
    }
  }
}

export function run(config?: IProjectRunnerConfig): Promise<void> {
  return new ProjectRunner(config).run()
}

function isPostgresUrl(cs: string): boolean {
  return cs.startsWith('postgres://') || cs.startsWith('postgresql://')
}
