---
name: wabot-async
description: Use when running background work in Wabot — fire-and-forget commands, scheduled deferred commands, cron handlers, or wrapping side-effectful methods in a DB transaction. Covers @command, @commandHandler, @cronHandler, @transaction, the Async service (runCommand, scheduleCommand, IScheduleAt), ICommandHandler / ICronHandler, and how the in-memory vs PG job/cron stores are wired by the project runner.
---

# Async commands, cron, and transactions

Wabot's async layer handles three kinds of work:

- **Commands** — typed messages with a registered handler. Run immediately (`runCommand`) or scheduled (`scheduleCommand`).
- **Crons** — handlers that fire on a cron expression.
- **Transactions** — wrap a method so all repository writes happen inside one DB transaction per registered adapter.

The job store, cron job store, and transaction adapter are auto-selected by the project runner based on `DATABASE_URL` (in-memory ↔ PostgreSQL). No manual registration.

## Commands

A command is a plain class decorated with `@command(name)`. Fields use the standard validators from `wabot-validation`.

```typescript
import { command, isNumber, isString, min } from '@wabot-dev/framework'

@command('orders.charge')
export class ChargeOrder {
  @isString() orderId!: string
  @isNumber() @min(1) amountCents!: number
}
```

The handler implements `ICommandHandler<C>` and is bound with `@commandHandler(Command)`:

```typescript
import { commandHandler, ICommandHandler, injectable } from '@wabot-dev/framework'
import { ChargeOrder } from './ChargeOrder'

@commandHandler(ChargeOrder)
export class ChargeOrderHandler implements ICommandHandler<ChargeOrder> {
  constructor(private payments: PaymentService) {}

  async handle(cmd: ChargeOrder) {
    await this.payments.charge(cmd.orderId, cmd.amountCents)
  }
}
```

Trigger it with the `Async` singleton:

```typescript
import { Async, container } from '@wabot-dev/framework'

const async = container.resolve(Async)

// Run as soon as a worker is free
await async.runCommand(ChargeOrder, { orderId: 'o_1', amountCents: 2500 })

// Schedule for later: absolute Date or relative delay
await async.scheduleCommand(ChargeOrder, { orderId: 'o_1', amountCents: 2500 }, { minutes: 30 })
await async.scheduleCommand(
  ChargeOrder,
  { orderId: 'o_1', amountCents: 2500 },
  new Date('2026-12-31T08:00:00Z'),
)
```

`IScheduleAt = Date | { seconds: number } | { minutes: number } | { hours: number } | { days: number }`.

`Async.runCommand` returns a `Job` immediately (it has an `id` you can persist). The payload is validated against the command class before the job is stored — bad shapes throw `CustomError`.

`@commandHandler` applies `@injectable()`. There is at most one handler per command name; registering a second throws.

## Cron handlers

```typescript
import { cronHandler, ICronHandler } from '@wabot-dev/framework'

@cronHandler({ name: 'daily-cleanup', cron: '0 3 * * *' })
export class DailyCleanup implements ICronHandler {
  constructor(private games: GameRepository) {}

  async handle() {
    // ...
  }

  // Optional. Called when handle() throws.
  async handleError(err: any) {
    // ...
  }
}
```

- `cron` accepts standard 5-field or 6-field (with seconds) cron expressions.
- `disabled: true` turns a handler off without removing it (useful for guarded rollouts).
- `@cronHandler` applies `@singleton()` automatically — do not stack lifecycle decorators.

The runner registers these into `CronScheduler`, which persists per-cron state in `CronJobRepository` so missed runs aren't replayed on restart.

## Transactions

`@transaction(dbNames?)` wraps an async method so every adapter listed runs the call inside a transaction. Without arguments, all registered adapters participate (today there is one: the runner registers `PgTransactionAdapter` under the name `'default'` when `DATABASE_URL` is Postgres).

```typescript
import { transaction } from '@wabot-dev/framework'

@injectable()
export class Checkout {
  @transaction()
  async checkout(orderId: string) {
    await this.orderRepository.update(...)
    await this.paymentRepository.create(...)
  }
}
```

Behavior:

- Repository writes performed inside the method go to the same client/connection.
- Throwing rolls back; returning commits.
- Nested `@transaction`-decorated calls reuse the outer transaction (no nested begin).
- Without Postgres no adapter is registered, so `@transaction()` just executes the method (no wrap). Naming a specific adapter (e.g. `@transaction(['default'])`) throws at call time if it isn't registered — never write `@transaction(['pg'])`.

## Manual run / stop

In production the runner discovers and starts everything. For testing or custom hosts:

```typescript
import {
  runCommandHandlers,
  runCronHandlers,
  stopCommandHandlers,
  stopCronHandlers,
} from '@wabot-dev/framework'

runCommandHandlers([ChargeOrderHandler])
runCronHandlers([DailyCleanup])

// later
stopCommandHandlers([ChargeOrderHandler])
stopCronHandlers([DailyCleanup])
```

`testAsync` is exported for integration tests against the real job/cron schedulers — see `wabot-ts/src/feature/async/testAsync.ts` for an example.

## Rules

- Command classes are _data_ classes. Don't put behavior on them — that belongs in the handler.
- Don't reuse a command name for two handlers. The framework throws on boot.
- Don't `await async.runCommand(...)` inside a request handler expecting it to finish synchronously — `runCommand` schedules the job and returns immediately. Use `async.scheduleCommand(..., { seconds: 0 })` if you want the same fire-and-forget behavior explicitly.
- Cron expressions in seconds (6 fields) are supported but be careful: the in-memory adapter polls fast, the PG adapter polls at a lower rate.
- Wrap multi-repository writes in `@transaction()` rather than chaining manual `withPgTransaction` calls.

## Testing

`createAsyncHarness({ register?, authInfo? })` from `@wabot-dev/framework/testing` runs `@command` handlers (`harness.execute(Command, data)` — real validation, returns the transformed command) and `@cronHandler` jobs (`harness.runCron(Handler)`) inline, with no PostgreSQL or polling workers. `isValidCronSequence` and `waitUntil` help with schedule assertions. See the `wabot-testing` skill.
