---
name: wabot-persistence
description: Use when defining entities, repositories, queries, pagination, indexes, per-adapter query extensions, or database migrations in Wabot. Covers Entity / IEntityData, @repository, the @query method-name DSL (find/findOne/count/exists/delete + And/Or + operators), cursor/keyset pagination (findPage, IPageOptions, IPage, opaque nextCursor, fixed created_at ordering), multiple databases via @dbPool / IDbPoolProvider providers referenced by @repository({ pool }), read-only repositories (ReadRepository) for CQRS read models / replicas, connection pool tuning (WABOT_PG_*), per-repository audit trails (audit: config, append-only audit_<stream> tables, recover() as a soft-delete replacement, AuditLog.record/query for custom streams, IAuditActor + optional AuditActorResolver, actor carried across commands), @queryExtension, @memExtension / MemoryRepositoryExtension, @dbExtension with PgJsonbRepositoryExtension or PgColumnsRepositoryExtension, the storage strategy declared by the repository base class (PgJsonbRepository / PgColumnsRepository and their Read variants), the optional fields projection, automatic + explicit indexes, add.columns promotion, plain-SQL migrations via the wabot-migrate CLI, the document-to-columns swap, and how the active backend is chosen automatically by the project runner.
---

# Persistence

Wabot ships a small ORM. You write a domain entity, a `@repository`-decorated class with method-name queries, and (optionally) an adapter-specific extension. The project runner picks the adapter automatically based on `DATABASE_URL`.

## Entity

```typescript
import { Entity, IEntityData } from '@wabot-dev/framework'

export type IGameStatus = 'backlog' | 'playing' | 'finished' | 'abandoned'

export interface IGameData extends IEntityData {
  userId: string
  title: string
  status: IGameStatus
  hoursPlayed: number
  addedAt: number
}

export class Game extends Entity<IGameData> {}
```

`IEntityData` adds `id?: string`, `createdAt?: number | null`. The id/createdAt are filled in by the repository on `create`. There is no soft-delete field: `delete()` is a hard delete — use `audit` (below) to keep destroyed objects reviewable/recoverable.

`Entity` exposes:

- `id` (throws if not yet created)
- `createdAt: Date`
- `update(partial)` — merges allowed fields and sets `updatedAt`; rejects writes to id/createdAt
- `wasCreated()`, `validate()`
- `lockerKey()` — returns the id, so any `Entity` can be passed to `Locker.withKey(...)`

Date values stored on entity data should be epoch milliseconds (`number`) — the `Mapper` and `Storable` deep-copy convert `Date` to ms automatically.

## Repository

```typescript
import { CrudRepository, query, queryExtension, repository } from '@wabot-dev/framework'
import { Game, IGameStatus } from './Game'
import { IGameRepositoryExtensions } from './IGameRepositoryExtensions'

@repository({ table: 'game', constructor: Game })
export class GameRepository
  extends CrudRepository<Game, IGameRepositoryExtensions>
  implements IGameRepositoryExtensions
{
  @query() declare findByUserIdAndStatus: (userId: string, status: IGameStatus) => Promise<Game[]>
  @query() declare countByUserIdAndStatus: (userId: string, status: IGameStatus) => Promise<number>
  @queryExtension() declare findLongestInBacklog: (userId: string, limit: number) => Promise<Game[]>
}
```

The decorator generates concrete implementations for `CrudRepository`'s methods (`find`, `findOrThrow`, `findByIds`, `findAll`, `create`, `update`, `delete`) and for every `@query()` declare. It also installs a lazy `.extension` accessor backed by the active adapter.

`@repository` applies `@singleton()` for you. Inject `GameRepository` directly anywhere.

## `@query` method-name DSL

`@query()` reads the method name and turns it into a structured query. Supported grammar:

- Prefix: `find`, `findOne`, `count`, `exists`, `delete`.
- Conditions: PascalCase field names joined by `And` / `Or`.
- Operators (suffix on the field): `Equals` (default), `Not`, `Like`, `NotLike`, `In`, `NotIn`, `Gt`, `Gte`, `Lt`, `Lte`, `IsNull`, `IsNotNull`.
- Ordering: append `OrderByField[Asc|Desc]` (chain multiple with `And`).
- Limit: append `LimitN`.

Examples that work:

```typescript
@query() declare findByUserId: (userId: string) => Promise<Game[]>
@query() declare findOneByUserIdAndStatus: (userId: string, status: IGameStatus) => Promise<Game | null>
@query() declare countByStatusInAndAddedAtGt: (statuses: IGameStatus[], addedAt: number) => Promise<number>
@query() declare existsByTitleLike: (title: string) => Promise<boolean>
@query() declare deleteByStatus: (status: IGameStatus) => Promise<void>
@query() declare findByUserIdOrderByAddedAtAscLimit10: (userId: string) => Promise<Game[]>
```

Argument count and order must match the conditions left-to-right. `IsNull`/`IsNotNull` take no argument; `In`/`NotIn` take an array.

If your query cannot be expressed by the DSL (joins, aggregates, JSON paths) use `@queryExtension()` instead — see below.

## Pagination (cursor)

Repositories page with a **keyset (cursor)**, not `OFFSET`, so the cost stays constant no matter how deep you go. Both entry points return `IPage<T> = { items: T[]; nextCursor?: string }` (both types are exported from `@wabot-dev/framework`):

- `findPage({ limit, cursor? })` — page over **all** entities. A CRUD method, always available; no declaration needed.
- Any `find…` query method with a **trailing `IPageOptions`** argument switches that call to paginated. Declare the overload so both shapes are typed:

```typescript
@query() declare findByUserIdAndStatus: {
  (userId: string, status: IGameStatus): Promise<Game[]>
  (userId: string, status: IGameStatus, page: IPageOptions): Promise<IPage<Game>>
}
```

Walk pages until `nextCursor` is absent:

```typescript
let cursor: string | undefined
do {
  const page = await games.findByUserIdAndStatus(userId, 'playing', { limit: 20, cursor })
  render(page.items)
  cursor = page.nextCursor
} while (cursor)
```

`nextCursor` is an **opaque** base64url token — send it back verbatim as the next `cursor`; never build or parse it. A malformed or stale cursor is treated as the first page. Works identically on every backend (memory, document, columns).

### Ordering is fixed to `created_at DESC, id DESC`

Cursor pages always come back **newest-first**, tie-broken by `id`. That tuple is exactly what keeps the cursor stable and index-friendly, so it is **not** configurable — you cannot cursor-paginate by another column through `findPage` / `IPageOptions`.

To sort by a different field, use an `OrderBy…` query method with `Limit`. This returns a **plain bounded array** (no cursor, no `IPage`) — good for top-N lists, not for walking a large table:

```typescript
@query() declare findByUserIdOrderByHoursPlayedDescLimit50: (userId: string) => Promise<Game[]>
```

If you need a custom sort **and** deep paging together, hand-write keyset SQL in a `@queryExtension()`: promote the sort field to a real column (`add.columns`) or move the repo to column storage, then order by `(yourField, id)` and compare against a cursor you carry yourself. The built-in `created_at` cursor is the supported default; anything else is a manual extension.

## Adapter extensions

The runner picks the backend per process from `DATABASE_URL`:

- **memory** — `MemoryRepositoryAdapter` when `DATABASE_URL` is missing or not a `postgres://` URL. Always the fallback when there is no database.
- **Postgres** — when `DATABASE_URL` is a Postgres URL.

A repository has at most two extension slots. The **repository's own base class declares the storage strategy** (see _Scaling_); an extension only holds the queries the DSL cannot express, and has to agree with what the repository declared:

- `@memExtension(Repo)` on a class extending `MemoryRepositoryExtension<T>` — the in-RAM implementation (tests / no DB).
- `@dbExtension(Repo)` on a class extending `PgJsonbRepositoryExtension<T>` (document storage) **or** `PgColumnsRepositoryExtension<T>` (column storage). Declaring the wrong one for the repository is refused when the module is imported.

You only need an extension when a query can't be expressed by the `@query` DSL. For each `@queryExtension()` method, ship one implementation per backend you support:

```typescript
import {
  dbExtension,
  memExtension,
  MemoryRepositoryExtension,
  PgJsonbRepositoryExtension,
} from '@wabot-dev/framework'

@memExtension(GameRepository)
export class GameMemoryQueries
  extends MemoryRepositoryExtension<Game>
  implements IGameRepositoryExtensions
{
  async findLongestInBacklog(userId: string, limit: number) {
    return [...this.items.values()]
      .filter((g) => g['data'].userId === userId && g['data'].status === 'backlog')
      .sort((a, b) => a['data'].addedAt - b['data'].addedAt)
      .slice(0, limit)
      .map((g) => this.clone(g))
  }
}

@dbExtension(GameRepository)
export class GamePgQueries
  extends PgJsonbRepositoryExtension<Game>
  implements IGameRepositoryExtensions
{
  async findLongestInBacklog(userId: string, limit: number) {
    const sql = `
      SELECT ${this['columns']} FROM ${this['table']}
      WHERE "data"->>'userId' = $1 AND "data"->>'status' = 'backlog'
      ORDER BY ("data"->>'addedAt')::numeric ASC
      LIMIT $2
    `
    return this['query'](sql, [userId, limit])
  }
}
```

- The extension class must extend the matching base (`MemoryRepositoryExtension<T>` for `@memExtension`; a `Pg…RepositoryExtension<T>` for `@dbExtension`). The decorator throws otherwise.
- Inside a Postgres JSONB extension, fields live under a `data` JSONB column — use `this['columns']` / `this['table']` / `this['query'](sql, params)` from the base.
- A repository may support only one backend — if you only ship `@memExtension`, it throws when invoked under Postgres, and vice-versa.

> `@pgExtension` / `PgRepositoryExtension` are deprecated aliases of `@dbExtension` / `PgJsonbRepositoryExtension`, and `PgSqlRepositoryExtension` of `PgColumnsRepositoryExtension`. Existing code keeps working; use the new names going forward.

## Indexes (Postgres)

Indexes are created **automatically**. `@repository` derives them from your `@query` methods — equality filters → a btree on the `data->>'field'` expression, comparisons / `OrderBy` → btree — so JSONB queries actually hit an index. They are created idempotently on first use (`CREATE INDEX IF NOT EXISTS`; a failure is logged, not fatal).

Add to or override the auto set with `indexes`:

```typescript
@repository({
  table: 'game',
  constructor: Game,
  indexes: [
    { fields: ['tags'], kind: 'contains' },           // GIN, for JSON/array containment (@>)
    { fields: ['userId', 'status'], kind: 'exact' },  // composite btree
    { fields: ['status'], disabled: true },           // opt out of the auto index
  ],
})
```

`kind`: `exact` (default) · `range` · `contains` (GIN) · `text`. An explicit entry for the same field set overrides the auto one; `disabled: true` opts out.

**Promote a hot field to a real typed column** — native comparison/ordering plus a real btree — with `add.columns`. Queries on a promoted field then use the column (no `::numeric` cast) and its index:

```typescript
@repository({
  table: 'game',
  constructor: Game,
  add: { columns: { hoursPlayed: { type: 'numeric', value: (g) => g['data'].hoursPlayed } } },
})
```

## Scaling: column storage + migrations

Document storage (JSONB) is the easy default but doesn't scale as well. When a repository needs real columns, switch its **base class** — services, controllers, `@query` methods and tests all stay the same.

**1. Extend the column-storage base:**

```typescript
import { PgColumnsRepository, repository } from '@wabot-dev/framework'

@repository({
  table: 'game',
  constructor: Game,
  fields: ['userId', 'title', 'status', 'hoursPlayed', 'addedAt'], // optional
})
export class GameRepository extends PgColumnsRepository<Game> {
  /* the same @query methods as before */
}
```

The base class is what the backend reads: `PgColumnsRepository` → a column per field, `PgJsonbRepository` → the document, and plain `CrudRepository` → whatever the active backend defaults to (JSONB on Postgres). Read-only variants exist for CQRS read models: `PgColumnsReadRepository`, `PgJsonbReadRepository`.

The name says Postgres, but it does not tie the repository to it: with no database the memory backend serves any of them, so `DATABASE_URL`-less development keeps working. A _different_ engine, once one exists, refuses a repository declared for another with a clear error.

`fields` is an optional **projection**: those fields alone are read and written, and anything else in the row is invisible to that repository — the way to sit a repository on a wide or legacy table. Omit it to take the whole row. The memory backend honours it too, so dev matches production. Column name = field name (`id`/`createdAt` map to the `id`/`created_at` columns). **No auto-DDL**: you own the schema via migrations.

An extension is still optional here; add one extending `PgColumnsRepositoryExtension<Game>` only when you need hand-written SQL.

**2. Write the migration(s) in plain SQL and apply them:**

```bash
wabot-migrate create "create game table"   # → migrations/0001_create_game_table.sql
# edit the .sql: CREATE TABLE game (...) + indexes; optional INSERT ... SELECT data->>... backfill
wabot-migrate up        # apply pending — advisory-locked, one tx each; never runs at boot
wabot-migrate status    # applied / pending / drifted
```

Migrations are forward-only plain `.sql` files under `./migrations`, tracked in a `_wabot_migrations` table with a SHA-256 checksum. Editing an already-applied migration is refused (drift) — add a new migration instead. `wabot-migrate up`/`status` read `DATABASE_URL`; `create` needs no database.

## Connection pool tuning (Postgres)

The runner creates **one** `pg.Pool` shared by every repository/adapter. Tune it with env vars — defaults are production-safe, so you only set what you need:

| Env var                          | Default | pg option                 | Notes                                                           |
| -------------------------------- | ------- | ------------------------- | --------------------------------------------------------------- |
| `WABOT_PG_POOL_MAX`              | `10`    | `max`                     | Max clients. The main throughput knob.                          |
| `WABOT_PG_POOL_MIN`              | `0`     | `min`                     | Warm idle clients kept open.                                    |
| `WABOT_PG_IDLE_TIMEOUT_MS`       | `10000` | `idleTimeoutMillis`       | Close a client after it sits idle this long.                    |
| `WABOT_PG_CONNECTION_TIMEOUT_MS` | `10000` | `connectionTimeoutMillis` | Wait for a free client, then fail. pg's default waits forever.  |
| `WABOT_PG_MAX_LIFETIME_SECONDS`  | `0`     | `maxLifetimeSeconds`      | `0` = off. Recycle long-lived clients (behind a load balancer). |
| `WABOT_PG_STATEMENT_TIMEOUT_MS`  | `0`     | `statement_timeout`       | `0` = off. Server-side cap on runaway queries.                  |
| `WABOT_PG_APP_NAME`              | `wabot` | `application_name`        | Identifies the process in `pg_stat_activity`.                   |

The pool also has an `error` listener (an idle client dropping its connection is logged and recycled, never crashes the process) and, when `@opentelemetry/api` is installed, exports gauges `wabot.pg.pool.total` / `.idle` / `.waiting`, labeled by `database` — watch `waiting > 0` for pool saturation. The `wabot-migrate` CLI uses its own short-lived pool, unaffected by these.

## Multiple databases

By default every repository uses `DATABASE_URL`. To talk to more than one database, define a **pool provider** — a class with `@dbPool` implementing `IDbPoolProvider` — and point a repository at it by **class reference**:

```typescript
import { dbPool, IDbPoolProvider } from '@wabot-dev/framework'

@dbPool()
export class ReportingDb implements IDbPoolProvider {
  connection() {
    return process.env.REPORTING_DATABASE_URL! // string | Promise<string>
  }
  pool?() {
    return { max: 20 } // optional per-database overrides, layered over WABOT_PG_*
  }
}
```

```typescript
@repository({ table: 'event', constructor: Event, pool: ReportingDb })
export class EventRepository extends CrudRepository<Event> {}

// no `pool` → the default database (DATABASE_URL)
@repository({ table: 'user', constructor: User })
export class UserRepository extends CrudRepository<User> {}
```

- The runner discovers every referenced provider at boot, resolves it through DI (so `connection()` may be `async` — fetch it from a secret store), and builds **one tuned pool per provider** (own `application_name`, shutdown, metrics). Referencing the class guarantees the provider is wired before any repository runs.
- If a provider's `connection()` is empty / not Postgres, **that** database falls back to its own in-memory store — tests need no DB even for extra databases.
- Referencing a class that isn't `@dbPool`, or one that couldn't be wired, fails fast at boot.
- The framework's non-repository services (chat memory, jobs, locker, idempotency, rate limiting) stay on the **default** database. A `@transaction()` cannot span two physical databases.

To source the **default** database itself from a provider (e.g. its URL from a secret store), pass one to `run` — a single field, so there is never more than one default:

```typescript
// _run_.ts
export const config: IProjectRunnerConfig = { defaultDatabase: SecretsDb }
```

Repositories with no `pool` (and the non-repository services) then use it; omit it and the default stays `DATABASE_URL`.

### Read-only repositories (CQRS)

Extend `ReadRepository<T>` instead of `CrudRepository<T>` for a **read model**: the decorator installs only the read methods (`find`, `findByIds`, `findAll`, `findPage`, and your `@query` finders / `count` / `exists`) and **refuses `deleteBy…` queries** at boot. There is no `create`/`update`/`delete` — the type prevents writes, so it is safe to route at a read replica.

```typescript
import { ReadRepository } from '@wabot-dev/framework'

@dbPool()
export class ReplicaDb implements IDbPoolProvider {
  connection() {
    return process.env.DATABASE_REPLICA_URL!
  }
}

// Read model on the replica — no writes possible
@repository({ table: 'order', constructor: Order, pool: ReplicaDb })
export class OrderReadRepository extends ReadRepository<Order> {
  @query() declare findByCustomerId: (customerId: string) => Promise<Order[]>
}

// Write model on the primary (default pool) — or use @commandHandler (see wabot-async)
@repository({ table: 'order', constructor: Order })
export class OrderRepository extends CrudRepository<Order> {}
```

Reads on a replica are **eventually consistent** (replication lag): if a flow must read what it just wrote, read it from the primary.

## Audit trail (and the soft-delete replacement)

Auditing is **off by default**, enabled per repository. Prefer it over soft-deletion: `delete()` really removes the row (clean tables, no soft-delete flag polluting queries/indexes), and the destroyed object is preserved in an append-only audit stream — reviewable and **recoverable**.

```typescript
@repository({
  table: 'order',
  constructor: Order,
  audit: true, // all events; or { events: ['destroy'], stream: 'order', pool: AuditDb }
})
export class OrderRepository extends CrudRepository<Order> {}

await orders.delete(order) // hard DELETE + a 'destroyed' snapshot in stream `order`
const back = await orders.recover(order.id) // re-insert from the snapshot, same id
```

- **Events** `create` / `update` / `destroy` (default all). Each records the entity snapshot; `destroy` is what makes recovery work.
- **Storage scales**: each stream is its **own** append-only table `audit_<stream>` (default stream = the table name), so millions of rows shard by domain. **Pool** defaults to the repository's data pool; set `audit.pool` to isolate the trail in another database.
- **Append-only**: no update/delete — it is the durable record.

Every entry auto-captures **who** (actor), **when**, the correlation id, and provenance (`source`) — callers only say what happened. Read a stream back (investigations) by injecting `AuditLog`:

```typescript
const trail = await auditLog.query({ stream: 'order', target: orderId, action: 'destroyed' })
```

For domain events not tied to an entity, record to any **custom stream**:

```typescript
await auditLog.record({
  stream: 'security',
  action: 'user.role_changed',
  target: userId,
  metadata: { from, to },
})
```

### The actor (who caused the change)

The actor rides the log context, captured automatically:

| Origin                | actor                                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Authenticated request | `{ type: 'user', … }`                                                                                                                       |
| Cron                  | `{ type: 'cron', id: cronName }`                                                                                                            |
| Command               | **inherits** the actor that dispatched it — carried across the async/deferred boundary on the job; the command name is recorded as `source` |
| None (boot/script)    | `{ type: 'system' }`                                                                                                                        |

Because `Auth<D>` is app-shaped, the framework never guesses a user id — an authenticated action defaults to a bare `{ type: 'user' }`. To attribute a real id/label, register an **`AuditActorResolver`** (optional):

```typescript
class MyAuditActor extends AuditActorResolver {
  fromAuth(info: MyAuthInfo) {
    return { type: 'user' as const, id: info.userId, label: info.email }
  }
}
container.register(AuditActorResolver, { useClass: MyAuditActor })
```

## Transactions

Wrap business methods with `@transaction()` — it runs the call inside every registered transaction adapter:

```typescript
import { transaction } from '@wabot-dev/framework'

class CheckoutService {
  @transaction()
  async checkout(orderId: string) {
    // all repository writes here run inside one PG transaction
  }
}
```

The project runner registers a `PgTransactionAdapter` under the name `'default'` when `DATABASE_URL` is Postgres (so `@transaction(['default'])` also works); without Postgres no adapter is registered and `@transaction()` executes the method directly. Never write `@transaction(['pg'])` — naming an unregistered adapter throws at call time. See `wabot-async` for command-level transactions.

## Rules

- Always declare the full type on `@query() declare` properties — the decorator uses the method name only, but TypeScript needs the signature.
- Don't write SQL or memory iteration inside `@query()` methods — that's what `@queryExtension` is for.
- Never mutate `entity['data']` directly outside the entity class. Use `entity.update(...)` or domain methods.
- Repository classes are singletons; do not store per-request state on them.

## Testing

`useMemoryRepositories()` from `@wabot-dev/framework/testing` backs every `@repository` with an in-RAM adapter (no PostgreSQL, no `.wabot/` persistence) — call it once at the top of the test file, before anything resolves a repository. `entityFixture(Entity, data, { id? })` seeds already-created, validated entities. See the `wabot-testing` skill.
