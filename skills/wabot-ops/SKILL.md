---
name: wabot-ops
description: Use when reaching for cross-cutting utilities in a Wabot app — structured logging, distributed/in-process locking, custom errors with HTTP codes, password hashing, secure random generators, or process-level error handlers. Covers Logger (6 levels via debug + optional IErrorMonitor), Locker / ILockKey / ILockerKey (in-memory + PG implementations selected by DATABASE_URL), CustomError, setupErrorHandlers, Password (scrypt-based), and Random.
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

| Level | Use for |
| --- | --- |
| `trace` | Per-request / per-message firehose |
| `debug` | Developer-facing flow detail |
| `info` | Lifecycle events worth keeping |
| `warn` | Recoverable anomaly, handled gracefully |
| `error` | Operation failed; include the `Error` object |
| `fatal` | Process cannot continue (uncaught exception / unhandled rejection) |

Always pass the `Error` instance as one of the args — the logger serializes it cleanly. Extra object args are merged into a `extra` field reported to the monitor (see below).

### Optional error monitor

`Logger.setMonitor(monitor)` attaches an `IErrorMonitor` that receives `warn` / `error` / `fatal` events. Use this to plug Sentry / Datadog / etc.:

```typescript
import { Logger, IErrorMonitor, IErrorMonitorContext } from '@wabot-dev/framework'

const monitor: IErrorMonitor = {
  captureError(err, ctx) { /* Sentry.captureException(err, { extra: ctx }) */ },
  captureMessage(msg, ctx) { /* ... */ },
}

Logger.setMonitor(monitor)
```

### `setupErrorHandlers`

Call once at boot to convert `uncaughtException` / `unhandledRejection` into structured logs (and process exits, by default):

```typescript
import { setupErrorHandlers } from '@wabot-dev/framework'

setupErrorHandlers({
  exitOnUncaughtException: true,
  exitOnUnhandledRejection: true,
})
```

When using the project runner, the framework wires its own logger; you usually don't need to call this in app code.

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

Random.integer({ min: 0, max: 99 })       // uniform
Random.slug('Hola Mundo', { randomLength: 6 }) // "hola-mundo-x9k2qr"
Random.alphaNumeric(32)
Random.alphaNumericLowerCase(32)
Random.numberCode(6)                      // 6-digit OTP
```

All generators use `crypto.randomBytes` and reject biased ranges — safe to use for tokens, OTPs, and slugs.

## Rules

- Pass `Error` objects to `log.error/log.fatal`, not stringified messages. The monitor pipeline expects the real Error.
- Use `CustomError` for any error that crosses a controller boundary so HTTP/socket clients get a sensible status.
- Don't roll your own password hashing — use `Password.hash` / `Password.isValid`.
- Don't use `Math.random()` for IDs, tokens, OTPs, or anything user-facing. Use `Random`.
- Lock keys should encode the *resource* being protected. Prefer entities (via `ILockerKey`) over loose strings to prevent typos.
