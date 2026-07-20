---
name: wabot-persistence
description: Use when defining entities, repositories, queries, pagination, indexes, per-adapter query extensions, or database migrations in Wabot. Covers Entity / IEntityData, @repository, the @query method-name DSL (find/findOne/count/exists/delete + And/Or + operators), cursor/keyset pagination (findPage, IPageOptions, IPage, opaque nextCursor, fixed created_at ordering), @queryExtension, @memExtension / MemoryRepositoryExtension, @dbExtension with PgJsonbRepositoryExtension (JSONB, default) or PgSqlRepositoryExtension (relational columns), automatic + explicit indexes, add.columns promotion, plain-SQL migrations via the wabot-migrate CLI, the JSONB→relational swap, and how the active backend is chosen automatically by the project runner.
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

`IEntityData` adds `id?: string`, `createdAt?: number | null`, `discardedAt?: number | null`. The id/createdAt are filled in by the repository on `create`.

`Entity` exposes:

- `id` (throws if not yet created)
- `createdAt: Date`
- `update(partial)` — merges allowed fields and sets `updatedAt`; rejects writes to id/createdAt/discardedAt
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
@query() declare deleteByDiscardedAtIsNotNull: () => Promise<void>
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

`nextCursor` is an **opaque** base64url token — send it back verbatim as the next `cursor`; never build or parse it. A malformed or stale cursor is treated as the first page. Works identically on every backend (memory, JSONB, relational).

### Ordering is fixed to `created_at DESC, id DESC`

Cursor pages always come back **newest-first**, tie-broken by `id`. That tuple is exactly what keeps the cursor stable and index-friendly, so it is **not** configurable — you cannot cursor-paginate by another column through `findPage` / `IPageOptions`.

To sort by a different field, use an `OrderBy…` query method with `Limit`. This returns a **plain bounded array** (no cursor, no `IPage`) — good for top-N lists, not for walking a large table:

```typescript
@query() declare findByUserIdOrderByHoursPlayedDescLimit50: (userId: string) => Promise<Game[]>
```

If you need a custom sort **and** deep paging together, hand-write keyset SQL in a `@queryExtension()`: promote the sort field to a real column (`add.columns`) or move the repo to the relational strategy, then order by `(yourField, id)` and compare against a cursor you carry yourself. The built-in `created_at` cursor is the supported default; anything else is a manual extension.

## Adapter extensions

The runner picks the backend per process from `DATABASE_URL`:

- **memory** — `MemoryRepositoryAdapter` when `DATABASE_URL` is missing or not a `postgres://` URL. Always the fallback when there is no database.
- **Postgres** — when `DATABASE_URL` is a Postgres URL.

A repository has at most two extension slots, and **the base class you extend selects the storage strategy**:

- `@memExtension(Repo)` on a class extending `MemoryRepositoryExtension<T>` — the in-RAM implementation (tests / no DB).
- `@dbExtension(Repo)` on a class extending `PgJsonbRepositoryExtension<T>` (JSONB, the default) **or** `PgSqlRepositoryExtension<T>` (relational columns — see _Scaling_ below).

You only need an extension when a query can't be expressed by the `@query` DSL, or to opt a repository into the relational strategy. For each `@queryExtension()` method, ship one implementation per backend you support:

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

> `@pgExtension` / `PgRepositoryExtension` are deprecated aliases of `@dbExtension` / `PgJsonbRepositoryExtension`. Existing code keeps working; use the new names going forward.

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

## Scaling: relational storage + migrations

JSONB is the easy default but doesn't scale as well. When a repository needs real columns, switch it to the relational strategy **without touching business code** — services, controllers, `@query` methods and tests all stay the same.

**1. Point the repo's `@dbExtension` at the relational base and declare the columns:**

```typescript
import {
  CrudRepository,
  dbExtension,
  PgSqlRepositoryExtension,
  repository,
} from '@wabot-dev/framework'

@repository({
  table: 'game',
  constructor: Game,
  columns: ['userId', 'title', 'status', 'hoursPlayed', 'addedAt'],
})
export class GameRepository extends CrudRepository<Game> {
  /* the same @query methods as before */
}

@dbExtension(GameRepository)
export class GameSql extends PgSqlRepositoryExtension<Game> {
  // selects the relational strategy; add hand-written SQL methods here if needed
}
```

Column name = field name (`id`/`createdAt` map to the `id`/`created_at` columns). Every queried field must be a declared column — there is no `data` blob to fall back to. **No auto-DDL**: you own the schema via migrations.

**2. Write the migration(s) in plain SQL and apply them:**

```bash
wabot-migrate create "create game table"   # → migrations/0001_create_game_table.sql
# edit the .sql: CREATE TABLE game (...) + indexes; optional INSERT ... SELECT data->>... backfill
wabot-migrate up        # apply pending — advisory-locked, one tx each; never runs at boot
wabot-migrate status    # applied / pending / drifted
```

Migrations are forward-only plain `.sql` files under `./migrations`, tracked in a `_wabot_migrations` table with a SHA-256 checksum. Editing an already-applied migration is refused (drift) — add a new migration instead. `wabot-migrate up`/`status` read `DATABASE_URL`; `create` needs no database.

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
