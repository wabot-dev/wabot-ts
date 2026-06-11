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

# Development
npm run elia:dev                # Run test bot (Elia)
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

### Slack Channel Notes

`SlackChannel` runs in **Socket Mode**, so no public HTTP endpoint is required — the bot opens an outbound WebSocket to Slack.

**Configuration** (via `SlackChannelConfig`):

- `appToken` — `xapp-…` App-Level Token with scope `connections:write`
- `botToken` — `xoxb-…` Bot User OAuth Token
- `signingSecret` — optional, used by Bolt for verification

**Required Slack scopes on the bot:** `chat:write`, `users:read`, plus `im:history`, `mpim:history`, `channels:history`, `groups:history` to receive message events. Add `files:read` if you need metadata; downloads are authorized with `botToken` automatically.

**Event Subscriptions** (Socket Mode): enable `message.channels`, `message.groups`, `message.im`, `message.mpim`. Reinstall the app after adding scopes.

**Inbound file attachments**: messages with `subtype: 'file_share'` are downloaded in parallel (`Promise.all`), each ≤ 20 MB. Items with `mime` starting with `image/` are placed in `IChatMessage.images[]`; the rest go to `documents[]`. All files are converted to `base64Url` data URLs. If a file fails to download, it is skipped with a warning and the rest of the message is preserved. Caption (`text`) and attachments are delivered together to the mindset.

**Outbound replies always go to a thread**: `thread_ts = message.thread_ts ?? message.ts`. Top-level messages therefore create a one-message thread automatically. This keeps shared channels uncluttered.

**Outbound files (images/documents) sent by the bot are NOT yet supported** — only `text` is delivered. Planned as `feat-slack-uploads` using `filesUploadV2`.

**Usage example:**

```typescript
@chatController()
export class MyController {
  @slack({ appToken: str`SLACK_APP_TOKEN`, botToken: str`SLACK_BOT_TOKEN` })
  async onSlack(ctx: ISlackReceivedMessage) {
    await this.bot.sendMessage(ctx.message, async (response) => {
      await ctx.reply(response)
    })
  }
}
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

## Runtime Compatibility

The built framework (`dist/`) must run under both **Node.js** and **Bun**. The framework itself does not ship Bun tooling — compatibility is a code-level requirement, so consumer apps can pick either runtime.

**Rules for any code reachable from `src/index.ts`:**

- **Use the `node:` prefix for all Node builtin imports.** Examples: `import { readFile } from 'node:fs'`, `import { AsyncLocalStorage } from 'node:async_hooks'`, `import { Server } from 'node:http'`. Never use bare `'fs'`, `'path'`, `'http'`, `'crypto'`, `'async_hooks'`, `'readline'`, etc.
- **Do not use the `NodeJS.*` type namespace.** Prefer portable types: `ReturnType<typeof setTimeout>` instead of `NodeJS.Timeout`, `ReturnType<typeof setInterval>` instead of `NodeJS.Timer`. Avoids implicit dependency on `@types/node` global namespace augmentation.
- **Do not use Node-only APIs that lack a Bun equivalent.** Avoid `node:cluster`, `node:v8`, `node:inspector`, `node:trace_events`, `node:domain`, native `.node` addons, and `pg-native`. The Node APIs used today (`node:crypto`, `node:async_hooks`, `node:http`, `node:fs`, `node:path`, `node:readline`, `Buffer`, `process.env/cwd/exit/hrtime/stdin/stdout`, `setTimeout`/`setInterval`) are all supported by Bun's Node compat layer.
- **Test-only imports (`node:test`, `node:assert`, `node:child_process`) are allowed only in files that are NOT exported from `src/index.ts`** (e.g. `*.test.ts`, `__tests__/`, `testAsync.ts`, `testChatAdapter.ts`, `testAsyncHelpers.ts`, `pg-async-test-*.ts`). These must never reach `dist/`.

**Decorator stack note:** the framework relies on `tsyringe` + `reflect-metadata` with `experimentalDecorators` and `emitDecoratorMetadata`. Metadata is emitted at build time by Rollup's TS plugin, so consumers running Bun only need `reflect-metadata` imported at app entry — same as Node.

## Documentation

- Full docs: https://docs.wabot.dev
- Repository: https://github.com/wabot-dev/wabot-ts
