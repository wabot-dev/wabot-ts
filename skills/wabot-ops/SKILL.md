---
name: wabot-ops
description: Use when reaching for cross-cutting utilities in a Wabot app — structured logging, process lifecycle (graceful shutdown, crash handlers, readiness probes), distributed/in-process locking, idempotency / webhook deduplication, rate limiting, custom errors with HTTP codes, password hashing, or secure random generators. Covers Logger (6 levels via debug + optional IErrorMonitor), graceful shutdown + ShutdownManager.isShuttingDown, setupCrashHandlers (setupErrorHandlers deprecated), Locker / ILockKey / ILockerKey, Idempotency (alreadyProcessed / runOnce), RateLimiter (fixed-window) and the @rateLimit REST decorator — all with in-memory + PG implementations selected by DATABASE_URL — plus CustomError, Password (scrypt-based), and Random.
---

# Operations utilities

## Logger

```typescript
import { Logger } from '@wabot-dev/framework'

const log = new Logger('myapp:orders')

log.trace('http request', { method: 'GET', path: '/orders' })
log.debug('reconciling', { batchId })
log.info('orders worker started', { workers: 4 })
log.warn('retrying', err)
log.error('charge failed', err, { orderId })
log.fatal('out of memory', err)
```

The logger is a thin wrapper over the `debug` package. Each level publishes to namespace `<name>:<level>` so you can enable subsets via `DEBUG`:

```
DEBUG=wabot:*:error,wabot:*:warn,wabot:*:info
DEBUG=myapp:orders:*
```

Severity levels and intent (matches the framework's own usage):

| Level   | Use for                                                            |
| ------- | ------------------------------------------------------------------ |
| `trace` | Per-request / per-message firehose                                 |
| `debug` | Developer-facing flow detail                                       |
| `info`  | Lifecycle events worth keeping                                     |
| `warn`  | Recoverable anomaly, handled gracefully                            |
| `error` | Operation failed; include the `Error` object                       |
| `fatal` | Process cannot continue (uncaught exception / unhandled rejection) |

Always pass the `Error` instance as one of the args — the logger serializes it cleanly. Extra object args are merged into a `extra` field reported to the monitor (see below).

### Optional error monitor

`Logger.setMonitor(monitor)` attaches an `IErrorMonitor` that receives `warn` / `error` / `fatal` events. Use this to plug Sentry / Datadog / etc.:

```typescript
import { Logger, IErrorMonitor, IErrorMonitorContext } from '@wabot-dev/framework'

const monitor: IErrorMonitor = {
  captureError(err, ctx) {
    /* Sentry.captureException(err, { extra: ctx }) */
  },
  captureMessage(msg, ctx) {
    /* ... */
  },
}

Logger.setMonitor(monitor)
```

## Process lifecycle & readiness

The project runner installs process lifecycle handling automatically — you don't wire any of it:

- **Graceful shutdown** — `SIGTERM` / `SIGINT` disconnect chat channels, stop the job/cron pollers, drain in-flight jobs and HTTP requests, then close the DB pool. Bounded by `WABOT_SHUTDOWN_TIMEOUT_SECONDS` (default 30); a second signal forces an immediate exit.
- **Crash handlers** — `uncaughtException` / `unhandledRejection` are logged (and reported to the monitor, with a short flush window), then the process exits non-zero. The state is assumed corrupt, so it does **not** drain.

`setupCrashHandlers({ exitOnUncaughtException, exitOnUnhandledRejection })` installs the crash handlers manually if you run without the project runner. (`setupErrorHandlers` is a deprecated alias.)

### Readiness probe

The framework ships **no** `/health` endpoint on purpose — not every app has a web server, and the probe's transport (HTTP path, port, auth) is a deployment concern. It exposes `ShutdownManager.isShuttingDown` so you can build one where it fits your app.

For a zero-downtime rolling deploy, readiness must fail **before** the drain, so the load balancer stops routing new traffic while in-flight work finishes:

```typescript
import { CustomError, ShutdownManager } from '@wabot-dev/framework'
import { Pool } from 'pg'
// @restController / @onGet come from the framework — see the wabot-rest-socket skill

@restController('/health')
export class HealthController {
  constructor(
    private shutdown: ShutdownManager,
    private pool: Pool, // injected when DATABASE_URL is set
  ) {}

  @onGet('/ready')
  async ready() {
    if (this.shutdown.isShuttingDown) {
      // Draining: stop receiving new traffic. A returned value would be 200;
      // a thrown CustomError maps to its httpCode.
      throw new CustomError({ httpCode: 503, code: 'SHUTTING_DOWN', message: 'draining' })
    }
    await this.pool.query('SELECT 1') // real DB liveness; a failure throws → 500
    return { status: 'ok' }
  }
}
```

Point your orchestrator's **readiness** probe at `/ready`; a **liveness** probe can be simpler (process up = 200). What "ready" means beyond shutdown + DB is app-specific — add your own checks (LLM provider reachable, channels connected) as needed.

## `CustomError`

```typescript
import { CustomError } from '@wabot-dev/framework'

throw new CustomError({
  message: 'Order not found',
  humanMessage: 'No encontramos esa orden.',
  code: 'ORDER_NOT_FOUND',
  httpCode: 404,
  info: { orderId },
})
```

REST + Socket controllers translate thrown `CustomError`s into the right HTTP status / socket ack `{ error }`. `code` is meant for machine consumers; `humanMessage` is what you show users.

## `Locker`

`Locker.withKey(key)` returns an `ILockKey` you run code under. Two implementations are selected by the runner:

- `InMemoryLocker` — single-process locks.
- `PgLocker` — `pg_advisory_lock`-based locks, safe across processes.

```typescript
import { container, Locker, type ILockerKey } from '@wabot-dev/framework'

const locker = container.resolve(Locker)

// Any string or number
await locker.withKey('checkout:order-1').run(async () => {
  // critical section; waits for the lock
})

// tryRun returns undefined if the lock is held instead of waiting
const result = await locker.withKey('checkout:order-1').tryRun(async () => {
  return await charge()
})

// Anything implementing ILockerKey works — Entities do (their id is the key)
await locker.withKey(orderEntity).run(async () => { ... })
```

`ILockerKey { lockerKey(): string | number }` — implement on a domain type if you want to pass it directly.

## `Idempotency`

Deduplicate repeated events — chiefly webhook deliveries a provider retries. Like `Locker`, the runner selects an in-memory implementation or a Postgres one (atomic, safe across instances) from `DATABASE_URL`.

```typescript
import { container, Idempotency } from '@wabot-dev/framework'

const idempotency = container.resolve(Idempotency)

// true if `key` was already seen within the TTL (a duplicate to skip); records it on first sight
if (await idempotency.alreadyProcessed(`order-webhook:${eventId}`, 3600)) return

// or run something only once per key; the key is released if fn throws so a retry reprocesses
await idempotency.runOnce(`order-webhook:${eventId}`, 3600, async () => {
  await processOrder(eventId)
})
```

**Inbound chat dedup is automatic.** When a chat channel tags a delivery with `idempotencyKey` (a provider message id), `runChatControllers` skips duplicates within `WABOT_IDEMPOTENCY_TTL_SECONDS` (default 3600) — so webhook retries don't re-run the whole turn (or double-bill LLM calls). The WhatsApp Cloud API channel sets it from the message id; a custom channel sets `idempotencyKey` on the `IChannelMessage` it emits.

## `RateLimiter`

Fixed-window rate limiting — in-memory or Postgres (atomic per-window bucket, shared across instances), selected by `DATABASE_URL`.

```typescript
import { container, CustomError, RateLimiter } from '@wabot-dev/framework'

const limiter = container.resolve(RateLimiter)
const { allowed, remaining, resetAt } = await limiter.hit(`llm:${userId}`, {
  limit: 30,
  windowSeconds: 60,
})
if (!allowed) throw new CustomError({ httpCode: 429, message: 'Slow down' })
```

Use this to protect chat/LLM paths per user. For REST endpoints prefer the `@rateLimit` decorator (sets `X-RateLimit-*` / `Retry-After` and throws 429) — see the `wabot-rest-socket` skill.

## `Password`

```typescript
import { Password } from '@wabot-dev/framework'

const hash = Password.hash({ password: input })

const ok = Password.isValid({ password: candidate, hash })

const tempPassword = Password.generate(16)
```

`scrypt` with a random salt; defaults `saltLength: 16`, `keyLength: 64`. The hash format is `<salt>:<key>` (both hex).

## `Random`

```typescript
import { Random } from '@wabot-dev/framework'

Random.integer({ min: 0, max: 99 }) // uniform
Random.slug('Hola Mundo', { randomLength: 6 }) // "hola-mundo-x9k2qr"
Random.alphaNumeric(32)
Random.alphaNumericLowerCase(32)
Random.numberCode(6) // 6-digit OTP
```

All generators use `crypto.randomBytes` and reject biased ranges — safe to use for tokens, OTPs, and slugs.

## Rules

- Pass `Error` objects to `log.error/log.fatal`, not stringified messages. The monitor pipeline expects the real Error.
- Use `CustomError` for any error that crosses a controller boundary so HTTP/socket clients get a sensible status.
- Don't roll your own password hashing — use `Password.hash` / `Password.isValid`.
- Don't use `Math.random()` for IDs, tokens, OTPs, or anything user-facing. Use `Random`.
- Lock keys should encode the _resource_ being protected. Prefer entities (via `ILockerKey`) over loose strings to prevent typos.
