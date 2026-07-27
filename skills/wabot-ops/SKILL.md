---
name: wabot-ops
description: Use when reaching for cross-cutting utilities in a Wabot app — structured logging (pretty/JSON + correlation ids), OpenTelemetry tracing & metrics, process lifecycle (graceful shutdown, crash handlers, readiness probes), distributed/in-process locking, idempotency / webhook deduplication, rate limiting, custom errors with HTTP codes, password hashing, or secure random generators. Covers Logger (6 levels via debug + optional IErrorMonitor), graceful shutdown + ShutdownManager.isShuttingDown, setupCrashHandlers (setupErrorHandlers deprecated), Locker / ILockKey / ILockerKey, Idempotency (alreadyProcessed / runOnce), RateLimiter (fixed-window) and the @rateLimit REST decorator — all with in-memory + PG implementations selected by DATABASE_URL — plus CustomError, Password (scrypt-based), and Random.
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

Each level publishes to a `<name>:<level>` namespace. **Format is chosen automatically**: human-readable in a TTY (via the `debug` package), structured **JSON to stdout** when stdout is not a TTY (containers / prod). Override with `WABOT_LOG_FORMAT=pretty|json` or `Logger.configure({ format })`.

**Filtering (dev)** is the usual `debug` namespaces:

```
DEBUG=wabot:*:error,wabot:*:warn,wabot:*:info
DEBUG=myapp:orders:*
```

**Filtering (prod / JSON)** additionally honors a global floor — `WABOT_LOG_LEVEL=info` emits everything at that level or above without listing namespaces (combine with `DEBUG` to also include specific namespaces).

Severity levels and intent (matches the framework's own usage):

| Level   | Use for                                                            |
| ------- | ------------------------------------------------------------------ |
| `trace` | Per-request / per-message firehose                                 |
| `debug` | Developer-facing flow detail                                       |
| `info`  | Lifecycle events worth keeping                                     |
| `warn`  | Recoverable anomaly, handled gracefully                            |
| `error` | Operation failed; include the `Error` object                       |
| `fatal` | Process cannot continue (uncaught exception / unhandled rejection) |

Always pass the `Error` instance as one of the args — the logger serializes it (into `err` in JSON). String args form the `message`; object args become structured fields; the monitor (see below) receives the same.

### Correlation context

Every log line carries the fields of the active **log context** (an `AsyncLocalStorage` scope), so logs across a request/turn share a `requestId` — in JSON as fields, in pretty as a `[requestId=… chatId=…]` suffix. The framework opens a context automatically at each entry point (REST request, inbound chat message, job execution). Add your own scope or enrich the current one:

```typescript
import { runWithLogContext, addLogContext } from '@wabot-dev/framework'

await runWithLogContext({ userId }, async () => {
  addLogContext({ orderId }) // merge into the current scope after you learn it
  log.info('processing order') // JSON line includes requestId, userId, orderId
})
```

A `requestId` is generated when not provided. When OpenTelemetry is active (below), logs also carry the active `traceId` / `spanId`, so logs and traces line up.

### Tracing & metrics (OpenTelemetry)

OpenTelemetry is **optional**. Install `@opentelemetry/api` (a peer dependency) plus an SDK and the framework emits traces and metrics; without it every telemetry call is a zero-overhead no-op. Enable it in your app entry (`_run_.ts`) **before** `run()`:

```typescript
import { NodeSDK } from '@opentelemetry/sdk-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'

new NodeSDK({ traceExporter: new OTLPTraceExporter() }).start() // then run(config)
```

The framework instruments the boundaries out of the box:

- **Spans**: `http.request`, `chat.turn` (parent of the LLM/tool spans in a turn), `llm.completion` (with provider/model/token attributes), `tool.call`, `job`.
- **Metrics**: `wabot.llm.calls` / `input_tokens` / `output_tokens` / `cost_usd` / `latency_ms`, `wabot.chat.messages`, `wabot.tool.calls`, `wabot.jobs.executed` / `failed`.

Add your own from anywhere:

```typescript
import { withSpan, addCount, recordValue, setSpanAttributes } from '@wabot-dev/framework'

await withSpan('sync-orders', { source }, async () => {
  setSpanAttributes({ count })
  addCount('orders.synced', count, { source })
  recordValue('orders.sync_ms', elapsed)
})
```

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

- **Graceful shutdown** — `SIGTERM` / `SIGINT` disconnect chat channels, stop the job/cron pollers, drain in-flight jobs and HTTP requests, then close the DB pool. Bounded by `WABOT_SHUTDOWN_TIMEOUT_SECONDS` (30 in production, 3 outside it); a second signal forces an immediate exit, and the timeout log names the tasks still running.
- **Connection drain** — `server.close()` waits for the last socket, so one streaming response (SSE, a hanging fetch) would hold shutdown open for the whole deadline. Anything still connected after `WABOT_HTTP_DRAIN_TIMEOUT_SECONDS` (10 in production, 0.5 outside it) is cut. It is a deadline, not a delay: with nothing connected, close is immediate.
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

This is app-level fairness / cost control, **not a DoS shield** — reject volumetric floods at the edge (nginx / gateway / CDN). The Postgres backend short-circuits in-process once a key is over its limit (no DB round-trip per rejected request) and stores counters in an UNLOGGED table, since rate-limit state is disposable.

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
