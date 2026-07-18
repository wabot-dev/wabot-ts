---
name: wabot-persistence
description: Use when defining entities, repositories, queries, or per-adapter query extensions in Wabot. Covers Entity / IEntityData, @repository, the @query method-name DSL (find/findOne/count/exists/delete + And/Or + operators), @queryExtension, @memExtension / MemoryRepositoryExtension, @pgExtension / PgRepositoryExtension, and how the active adapter is chosen automatically by the project runner.
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

## Adapter extensions

The runner picks one adapter per process:

- `MemoryRepositoryAdapter` when `DATABASE_URL` is missing or not a `postgres://` URL.
- `PgJsonRepositoryAdapter` when `DATABASE_URL` is a Postgres URL (data is stored as a JSON blob per row).

For each `@queryExtension()` method you must provide one implementation per adapter you support, in classes decorated with `@memExtension(Repo)` and/or `@pgExtension(Repo)`:

```typescript
import {
  memExtension,
  MemoryRepositoryExtension,
  pgExtension,
  PgRepositoryExtension,
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

@pgExtension(GameRepository)
export class GamePgQueries
  extends PgRepositoryExtension<Game>
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

- The extension class must extend `MemoryRepositoryExtension<T>` / `PgRepositoryExtension<T>`. The decorator throws otherwise.
- Inside a Pg extension, use `this['columns']` / `this['table']` / `this['query'](sql, params)` from `PgRepositoryBase`. The Pg JSON adapter stores fields under a `data` JSONB column.
- A repository may opt in to only one adapter — if you only ship `@memExtension`, the repository will throw when invoked under Postgres.

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
