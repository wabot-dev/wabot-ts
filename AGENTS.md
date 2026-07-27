# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Wabot is a modern TypeScript framework for building AI-powered chatbots across multiple messaging platforms. Published as `@wabot-dev/framework` on npm. Documentation in Spanish, code in English.

## Development Commands

```bash
# Testing
npm run test:units              # Unit tests
npm run test:integration        # Integration tests (requires env vars)
npm run test:multiprocess       # Multiprocess tests

# Building
npm run build                   # Build with Rollup + tsup
npm run types:check             # Type check without emitting

# Code Quality
npm run fmt                     # Format with Prettier
npm run fmt:check               # Check formatting
```

## Architecture

### Three-Layer Architecture

```
src/
├── addon/      → Concrete implementations (swap-able)
│   ├── chat-bot/         → LLM adapters (OpenAI, Anthropic, Google, DeepSeek)
│   ├── chat-controller/  → Channels (Telegram, WhatsApp, Socket, Cmd)
│   ├── auth/             → Auth strategies (JWT, API Key)
│   └── async/            → Job backends (PostgreSQL)
│
├── feature/    → Business logic (abstract interfaces)
│   ├── chat-bot/         → ChatBot, Chat, ChatMemory, ChatItem
│   ├── chat-controller/  → Controller system, ChatResolver
│   ├── mindset/          → Bot personality, tools, prompts
│   ├── rest-controller/  → REST API endpoints
│   ├── async/            → Commands, Cron jobs, Job scheduling
│   └── pg/               → PostgreSQL base repository
│
└── core/       → Infrastructure (framework foundation)
    ├── injection/        → DI container (tsyringe)
    ├── entity/           → Entity base class
    ├── storable/         → Storable base class
    ├── validation/       → Decorator-based validation
    ├── repository/       → ICrudRepository interface
    └── description/      → Metadata description system
```

### Key Design Principle

**Metadata-Driven Architecture**: Decorators capture configuration at class/property definition time → MetadataStores maintain registries → Runtime code queries stores to dynamically wire components via DI.

## Core Patterns

### 1. MetadataStore Pattern

All feature configuration flows through singleton MetadataStores:

```typescript
// Pattern: Decorator → MetadataStore → Runtime Query
@singleton()
export class MyMetadataStore {
  private items = new Map<Function, IMyMetadata>()

  saveMetadata(metadata: IMyMetadata) {
    this.items.set(metadata.constructor, metadata)
  }

  getMetadata(ctor: Function): IMyMetadata | undefined {
    return this.items.get(ctor)
  }
}

// Decorator saves to store
export function myDecorator(config: IConfig) {
  return function (target: IConstructor<any>) {
    const store = container.resolve(MyMetadataStore)
    store.saveMetadata({ constructor: target, ...config })
  }
}
```

**Key MetadataStores:**

- `ValidationMetadataStore` - Property validators per model class
- `ControllerMetadataStore` - Chat controllers and channel mappings
- `ChatBotMetadataStore` - ChatBot instances with mindsets
- `RestControllerMetadataStore` - REST endpoints and methods
- `AsyncMetadataStore` - Commands, handlers, cron jobs
- `MindsetMetadataStore` - Mindset modules and tools
- `DescriptionMetadataStore` - Property/method descriptions for AI tools

### 2. Dependency Injection

Uses `tsyringe` from `@/core/injection`:

```typescript
import { container, injectable, singleton, inject } from '@/core/injection'

@singleton() // App-wide single instance
@injectable() // Can be resolved by DI
export class MyService {
  constructor(
    private dep: OtherService, // Auto-resolved
    @inject('TOKEN') private val: string, // Token-based injection
  ) {}
}

// Usage
const instance = container.resolve(MyService)

// Child containers for scoped instances (per-request, per-chat)
const childContainer = container.createChildContainer()
childContainer.registerInstance(Chat, chatInstance)
```

### 3. Entity & Storable Base Classes

**Storable** - Generic data container ensuring serializability:

```typescript
export class Storable<D extends object> {
  constructor(protected data: IStorableData<D>) {}
}
```

**Entity** - Extends Storable with id, timestamps, validation:

```typescript
export class Entity<D extends IEntityData> extends Storable<D> {
  get id() {
    return this.data.id
  }
  get createdAt() {
    return new Date(this.data.createdAt)
  }

  update(newData: Partial<Omit<D, 'id' | 'createdAt' | 'discardedAt'>>) {
    // Protected fields filtered out
  }

  validate() {
    // Override for custom validation
  }
}
```

**Creating a new Entity:**

```typescript
export interface IMyData extends IEntityData {
  name: string
  status: 'active' | 'inactive'
}

export class MyEntity extends Entity<IMyData> {
  get name() {
    return this.data.name
  }

  activate() {
    this.data.status = 'active'
  }

  override validate() {
    super.validate()
    if (!this.data.name) throw new Error('name required')
  }
}
```

### 4. Validation Decorator System

Validators are decorators that save metadata, queried at runtime:

```typescript
// Available validators
@isString() // String type
@isNumber() // Number type
@isBoolean() // Boolean type
@isDate() // Date type
@isNotEmpty() // Non-empty value
@isPresent() // Not null/undefined
@isOptional() // Marks optional
@min(value) // Minimum value
@max(value) // Maximum value
@isIn(allowedValues) // Value in set
@isArray(options) // Array with item validators
@isModel() // Nested object validation
@isRecord() // Key-value object

// Usage
export class CreateUserRequest {
  @isString()
  @isNotEmpty()
  name: string

  @isNumber()
  @isOptional()
  age?: number
}
```

### 5. Repository Pattern

**Interface (feature layer):**

```typescript
export interface ICrudRepository<T> {
  find(id: string): Promise<T | null>
  findOrThrow(id: string): Promise<T>
  create(item: T): Promise<void>
  update(item: T): Promise<void>
  delete(item: T): Promise<void>
}
```

**PostgreSQL Implementation (addon layer):**

```typescript
@singleton()
export class PgMyRepository extends PgCrudRepository<MyEntity> implements IMyRepository {
  constructor(pool: Pool) {
    super(pool, {
      schema: 'myapp',
      table: 'my_entities',
      constructor: MyEntity,
    })
  }

  // Custom queries
  async findByStatus(status: string): Promise<MyEntity[]> {
    const sql = `SELECT ${this.columns} FROM ${this.table} WHERE data->>'status' = $1`
    return await this.query(sql, [status])
  }
}
```

**Storage strategy:** a repository declares where its fields live by the base class it extends — `PgJsonbRepository` (one JSONB blob, framework-managed schema) or `PgColumnsRepository` (a real column per field, schema owned by migrations). Plain `CrudRepository` declares nothing and the active backend picks its default. The declaration is read off the class by `storageOf()` (a `static storage = { engine, strategy }` inherited through the constructor chain) and handed to `adapter.build()`; the memory backend ignores it, which is what keeps `DATABASE_URL`-less runs working whatever the base class.

`@repository({ fields })` is an optional projection: those fields alone are read and written, everything else in the row is invisible to that repository. The memory backend honours it too, so dev matches production. Two validations guard the pairing — `@dbExtension` refuses an extension whose strategy contradicts the repository's (at import time), and the adapter refuses a repository or extension declaring another engine (at build time).

## Extending the Framework

### Adding a New Chat Channel

**1. Create Channel Implementation:**

```typescript
// src/addon/chat-controller/mychannel/MyChannel.ts
@injectable()
export class MyChannel implements IChatChannel {
  private callback: ((message: IChannelMessage) => Promise<void>) | null = null

  constructor(private config: MyChannelConfig) {}

  listen(callback: (message: IChannelMessage) => Promise<void>): void {
    this.callback = callback
  }

  connect(): void {
    // Setup connection, on message received:
    // await this.callback({
    //   chatConnection: { id, channelName: MyChannel.name },
    //   message: { text, senderName },
    //   reply: async (msg) => { /* send reply */ }
    // })
  }
}
```

**2. Create Channel Config:**

```typescript
@injectable()
export class MyChannelConfig {
  constructor(public apiKey: string) {}
}
```

**3. Create Channel Decorator:**

```typescript
// src/addon/chat-controller/mychannel/@myChannel.ts
export function myChannel(config: string | IMyChannelConfig) {
  return function (target: object, propertyKey: string | symbol) {
    const store = container.resolve(ControllerMetadataStore)
    store.saveChannelMetadata({
      channelConstructor: MyChannel,
      functionName: propertyKey.toString(),
      controllerConstructor: target.constructor as IConstructor<any>,
      channelConfig: new MyChannelConfig(typeof config === 'string' ? config : config.apiKey),
    })
  }
}
```

**4. Export from index:**

```typescript
// src/addon/chat-controller/mychannel/index.ts
export * from './@myChannel'
export * from './MyChannel'
```

### Adding a New LLM Adapter

```typescript
// src/addon/chat-bot/myprovider/MyProviderAdapter.ts
@singleton()
export class MyProviderAdapter implements IChatAdapter {
  constructor(private env: Env) {
    // Initialize API client
  }

  async nextItems(req: IChatAdapterNextItemsReq): Promise<IChatAdapterNextItemsRes> {
    // 1. Transform req.prevItems to provider's message format
    // 2. Transform req.tools to provider's tool schema
    // 3. Call provider API with req.model, req.systemPrompt
    // 4. Parse response into IChatItemData[]
    // 5. Return { nextItems, usage: { inputTokens, outputTokens } }
  }
}
```

### Adding a REST Controller

```typescript
@restController('/api/users')
export class UserController {
  constructor(private userService: UserService) {}

  @onGet()
  async list() {
    return await this.userService.findAll()
  }

  @onGet('/:id')
  async getById(req: GetByIdRequest) {
    return await this.userService.findById(req.id)
  }

  @onPost()
  @middleware(AuthMiddleware)
  async create(req: CreateUserRequest) {
    return await this.userService.create(req)
  }

  @onPut('/:id')
  async update(req: UpdateUserRequest) {
    return await this.userService.update(req.id, req)
  }

  @onDelete('/:id')
  async delete(req: DeleteRequest) {
    await this.userService.delete(req.id)
  }
}
```

### Adding Async Commands

```typescript
// Define command (data structure)
@command('send-notification')
export class SendNotificationCommand extends Storable<{
  userId: string
  message: string
}> {}

// Define handler (processor)
@commandHandler(SendNotificationCommand)
export class SendNotificationHandler implements ICommandHandler<SendNotificationCommand> {
  constructor(private notificationService: NotificationService) {}

  async handle(command: SendNotificationCommand) {
    await this.notificationService.send(command.data.userId, command.data.message)
  }
}

// Schedule command
const scheduler = container.resolve(JobScheduler)
await scheduler.schedule(
  new SendNotificationCommand({
    userId: '123',
    message: 'Hello!',
  }),
)
```

### Adding Cron Jobs

```typescript
@cron({
  name: 'daily-cleanup',
  cron: '0 2 * * *', // 2 AM daily
  disabled: false,
})
export class DailyCleanupHandler implements ICronHandler {
  constructor(private cleanupService: CleanupService) {}

  async handle() {
    await this.cleanupService.removeOldData()
  }
}
```

### Adding Mindset Tools (AI Functions)

```typescript
// In your Mindset class, tools are methods with @description
@mindsetModule({ moduleName: 'calendar' })
export class CalendarModule {
  constructor(private calendarService: CalendarService) {}

  @description('Schedule a meeting with a person')
  async scheduleMeeting(args: ScheduleMeetingArgs): Promise<string> {
    const meeting = await this.calendarService.create(args)
    return `Meeting scheduled: ${meeting.id}`
  }
}

// Args class with validation (used by AI to understand parameters)
export class ScheduleMeetingArgs {
  @isString()
  @description('Name of the person to meet')
  personName: string

  @isDate()
  @description('Date and time of the meeting')
  dateTime: Date
}
```

## System Flows

### Chat Message Flow

```
Channel.listen() → IChannelMessage
  → ChatResolver.resolve() → Chat entity
  → ChatBot.sendMessage()
  → ChatMemory.create(humanMessage)
  → ChatBot.processLoop()
  → MindsetOperator.systemPrompt() + tools
  → ChatAdapter.nextItems() → LLM API
  → Process response (text/tool calls)
  → ChatMemory.create(botMessage)
  → channel.reply()
```

### REST Request Flow

```
HTTP Request
  → Express middleware (json, urlencoded)
  → Middleware chain (@middleware decorators)
  → Request validation (via ValidationMetadataStore)
  → Controller method invocation
  → JSON response (200) or error (400/500)
```

### Async Job Flow

```
JobScheduler.schedule(command)
  → Job created in JobRepository
  → JobRunner polls for pending jobs
  → CommandHandler.handle() executed
  → Job marked complete/failed
  → JobWatchdog monitors stuck jobs
```

## Starting Systems

```typescript
// Chat controllers
import { runChatControllers } from '@/feature/chat-controller'
runChatControllers([MyChatController])

// REST controllers
import { runRestControllers } from '@/feature/rest-controller'
runRestControllers([UserController, ProductController])

// Command handlers
import { runCommandHandlers } from '@/feature/async'
runCommandHandlers([SendNotificationHandler])

// Cron handlers
import { runCronHandlers } from '@/feature/async'
runCronHandlers([DailyCleanupHandler])
```

## Path Aliases

Defined in `tsconfig.json`:

```typescript
import { ... } from '@/core/injection'    // src/core/injection
import { ... } from '@/feature/chat-bot'  // src/feature/chat-bot
import { ... } from '@'                    // src/index.ts (public API)
```

## Key Interfaces

```typescript
// Chat
IChatMessage: { senderId?, senderName?, text?, images?, object?, metadata? }
IChannelMessage: { chatConnection, message, reply(), injectInstances? }
IChatConnection: { id, channelName }

// LLM
IChatAdapter: { nextItems(req): Promise<{ nextItems, usage }> }
IMindset: { context(), identity(), skills(), limits(), workflow(), llms() }
IMindsetTool: { name, description, parameters[] }

// Async
ICommandHandler<T>: { handle(command: T): Promise<void> }
ICronHandler: { handle(): Promise<void> }

// REST
IMiddleware: { handle(req, res, container): Promise<void> }
```

## Dependencies Note

Framework uses **peer dependencies**. Install only what you need:

- `grammy` for Telegram
- `@anthropic-ai/sdk` for Anthropic
- `openai` for OpenAI
- `@google/genai` for Google
- `pg` for PostgreSQL
- `socket.io` for WebSocket

## Testing System (`@wabot-dev/framework/testing`)

The framework ships a runner-agnostic testing module at `src/testing/` (subpath export `./testing`, second rollup/tsup entry). Nothing under `src/testing/` may import `node:test`, `node:assert` or `node:child_process` — it ships to `dist/`.

**Chatbots (deterministic, no API keys):**

```typescript
import { createChatBotHarness } from '@wabot-dev/framework/testing'

const harness = createChatBotHarness({
  mindset: EliaMindset,
  register: [[MyService, fakeService]], // DI overrides for module deps
  authInfo: { userId: 'u1' }, // assigned to container-scoped Auth
})
harness.adapter.callTool('saveEvent', { title: 'X' }).reply('done') // script the LLM
const turn = await harness.send('hola') // real ChatBot loop, real tool execution + validation
// turn.replies / turn.toolCalls / harness.history()
await harness.callTool('saveEvent', {}) // run ONE tool directly (returns the LLM-visible string)
await harness.systemPrompt()
harness.tools()
```

- `MockChatAdapter` — scriptable IChatAdapter (`reply`/`callTool`/`enqueue(fn)`), records `requests`. Throws if the queue is empty (a `callTool` turn triggers another adapter call).
- `createChatControllerHarness({ controller })` — drives a `@chatController` method end-to-end via the production `prepareChatContainer` (exported from `runChatControllers.ts`); `harness.invoke('onCmdMessage', 'hola')`.
- `TestChatMemory`/`TestChatRepository` — pure in-RAM (the `in-memory` addon persists to `.wabot/`, don't use it in tests).
- Fixtures: `humanMessage`, `imageMessage`, `documentMessage`, `humanItem`, `botItem`, `testImageBase64Url` (embedded receipt photo, total 11.570), `testPdfBase64Url`.

**Evals with real LLMs:** `new LlmJudge({ adapter, models }).evaluate({ transcript, criteria })` → `{ pass, reasoning }` (or `.assert(...)`). Verdict extracted via a forced `submitVerdict` tool call, provider-agnostic.

**Adapter conformance:** `chatAdapterConformanceCases({ adapter, model })` returns `{ name, run }[]` (runner-agnostic). `testChatAdapter` in `src/feature/chat-bot/` is the node:test wrapper used by the adapter integration tests.

**Rest of the framework:**

- `createRestHarness({ controllers, jwt: true, register })` — mounts `@restController`s on an ephemeral port via `registerRestControllers` (the no-listen split of `runRestControllers`); `api.request('POST', '/api/items', { body })`, `api.as(authInfo)` signs real JWTs for `@jwtGuard` (`api.as(authInfo, { cookie, audience })` sends them in a session cookie instead of the header and stamps the `aud` claim), `TestApiKeyRepository` (register as `ApiKeyRepository`) backs `@apiKeyGuard`. Call `api.close()` when done.
- `createAsyncHarness()` — `execute(CommandCtor, data)` validates and runs the `@commandHandler` inline; `runCron(CronCtor)` runs a `@cronHandler` once. No PG, no workers.
- `useMemoryRepositories()` — backs every `@repository` with `MemoryRepositoryAdapter` (`persist: false`). Call before resolving repositories (runtimes cache on first use).
- Validation: `validateFixture` / `assertValid` / `assertInvalid(Ctor, data, { path })` with flattened issue paths.
- Helpers: `waitUntil`, `wait`, `isValidCronSequence` (also re-exported by `testAsyncHelpers.ts`).

## Runtime Compatibility

The built framework (`dist/`) must run under both **Node.js** and **Bun**. The framework itself does not ship Bun tooling — compatibility is a code-level requirement, so consumer apps can pick either runtime.

**Rules for any code reachable from `src/index.ts`:**

- **Use the `node:` prefix for all Node builtin imports.** Examples: `import { readFile } from 'node:fs'`, `import { AsyncLocalStorage } from 'node:async_hooks'`, `import { Server } from 'node:http'`. Never use bare `'fs'`, `'path'`, `'http'`, `'crypto'`, `'async_hooks'`, `'readline'`, etc.
- **Do not use the `NodeJS.*` type namespace.** Prefer portable types: `ReturnType<typeof setTimeout>` instead of `NodeJS.Timeout`, `ReturnType<typeof setInterval>` instead of `NodeJS.Timer`. Avoids implicit dependency on `@types/node` global namespace augmentation.
- **Do not use Node-only APIs that lack a Bun equivalent.** Avoid `node:cluster`, `node:v8`, `node:inspector`, `node:trace_events`, `node:domain`, native `.node` addons, and `pg-native`. The Node APIs used today (`node:crypto`, `node:async_hooks`, `node:http`, `node:fs`, `node:path`, `node:readline`, `Buffer`, `process.env/cwd/exit/hrtime/stdin/stdout`, `setTimeout`/`setInterval`) are all supported by Bun's Node compat layer.
- **Test-only imports (`node:test`, `node:assert`, `node:child_process`) are allowed only in files that are NOT exported from `src/index.ts` or `src/testing/index.ts`** (e.g. `*.test.ts`, `__tests__/`, `testAsync.ts`, `testChatAdapter.ts`, `testAsyncHelpers.ts`, `pg-async-test-*.ts`). These must never reach `dist/` — note that `src/testing/` DOES ship to dist, so it must stay free of them.

**Decorator stack note:** the framework relies on `tsyringe` + `reflect-metadata` with `experimentalDecorators` and `emitDecoratorMetadata`. Metadata is emitted at build time by Rollup's TS plugin, so consumers running Bun only need `reflect-metadata` imported at app entry — same as Node.

## Documentation

- Full docs: https://docs.wabot.dev
- Repository: https://github.com/wabot-dev/wabot-ts
