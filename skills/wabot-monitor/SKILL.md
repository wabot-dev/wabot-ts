---
name: wabot-monitor
description: Use when building a custom monitor/dashboard page that shows a wabot app's own DOMAIN metrics (leads, orders, tickets, token spend, etc.) as server-rendered HTML. Covers the read-only PostgreSQL stats repository (COUNT/GROUP BY over the app's tables, fault-tolerant per query), the @uiController/@view SSR page, the shared UI kit (KpiCard/BarList/Section) and MonitorAuthMiddleware imported from @wabot-dev/framework/monitor, and createUiHarness/integration testing. For the framework's BUILT-IN operational monitor (conversations/messages/errors/jobs/cron) just `import '@wabot-dev/framework/monitor'` — no code; this skill is for domain metrics.
---

# Custom monitors

A monitor is a read-only, server-rendered dashboard page over a database. Wabot ships a built-in one at `/monitor` for the framework's universal operational metrics (conversations, messages, errors, async jobs, cron) — activate it with `import '@wabot-dev/framework/monitor'` and open `/monitor?key=<MONITOR_API_KEY>`. No code.

**This skill builds custom monitors for your app's domain data** — leads by status, orders by channel, open tickets, anything in your own tables. The canonical, complete implementation is the framework's own `src/addon/monitor`; custom monitors reuse its kit and follow its shape, but query your tables.

## Anatomy

Four pieces, mirroring `src/addon/monitor`:

1. **Read-only stats repository** — `@singleton()`, injects `Pool`, runs `COUNT`/`GROUP BY` over your tables.
2. **Stats service** — `@injectable()`, fans out repo calls and shapes the DTO.
3. **Controller + view** — `@uiController` + `@view` SSR page consuming the kit.
4. **Auth** — reuse `MonitorAuthMiddleware`.

## Read-only repository

Inject `Pool` from `pg` and run plain aggregate SQL. Do **not** extend `PgCrudRepository` for this — its `query()` maps every row into an entity and assumes a `data` column, which is useless for `COUNT`/`GROUP BY`. Wrap each query in `try/catch` returning a safe default, so a missing or lazily-created table can't take down the page.

```ts
import { Pool } from 'pg'
import { singleton } from '@wabot-dev/framework'

@singleton()
export class LeadsStatsRepository {
  constructor(private pool: Pool) {}

  async countByStatus(): Promise<{ name: string; count: number }[]> {
    try {
      const { rows } = await this.pool.query(
        `SELECT data->>'status' AS name, COUNT(*)::int AS count
           FROM myapp.lead GROUP BY 1 ORDER BY count DESC`,
      )
      return rows.map((r: any) => ({ name: r.name, count: Number(r.count) }))
    } catch {
      return []
    }
  }

  async countSince(since: Date): Promise<number> {
    try {
      const { rows } = await this.pool.query<{ count: number | string }>(
        'SELECT COUNT(*)::int AS count FROM myapp.lead WHERE created_at >= $1',
        [since],
      )
      return Number(rows[0]?.count ?? 0)
    } catch {
      return 0
    }
  }
}
```

Gotchas:

- **`bigint` comes back as a string** (node-pg avoids precision loss). Cast `::int` for counts; `Number(row.x)` for any `::bigint` column (e.g. epoch-ms timestamps stored in JSONB).
- **Schema/table is hardcoded** (`myapp.lead`) — there is no repo-config indirection at this layer.
- **`created_at`** is a `TIMESTAMP`; compare with a `Date` param. Epoch-ms values inside JSONB compare as numbers.

## Service

```ts
import { injectable } from '@wabot-dev/framework'

export interface LeadsDashboard {
  byStatus: { name: string; count: number }[]
  new24h: number
  total: number
  generatedAt: number
}

@injectable()
export class LeadsStatsService {
  constructor(private repo: LeadsStatsRepository) {}

  async getDashboard(): Promise<LeadsDashboard> {
    const now = Date.now()
    const [byStatus, new24h] = await Promise.all([
      this.repo.countByStatus(),
      this.repo.countSince(new Date(now - 86_400_000)),
    ])
    return {
      byStatus,
      new24h,
      total: byStatus.reduce((n, r) => n + r.count, 0),
      generatedAt: now,
    }
  }
}
```

## Controller & view

`@uiController` + `@view` come from `@wabot-dev/framework/ui`; the kit comes from `@wabot-dev/framework/monitor`. A view handler may be `async` and returns JSX.

```tsx
import { uiController, view } from '@wabot-dev/framework/ui'
import { KpiCard, BarList, Section, MonitorAuthMiddleware } from '@wabot-dev/framework/monitor'
import { LeadsStatsService } from './LeadsStatsService'
import type { LeadsDashboard } from './LeadsStatsService'

const CSS = `
  body { margin: 0; font: 14px/1.5 system-ui, sans-serif; background: #0f1115; color: #e6e6e6; }
  .wrap { max-width: 900px; margin: 0 auto; padding: 24px; }
  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
`

@uiController({ path: '/leads-monitor', middlewares: [MonitorAuthMiddleware] })
export class LeadsMonitorController {
  constructor(private stats: LeadsStatsService) {}

  @view({ title: 'Leads' })
  async dashboard() {
    const data: LeadsDashboard = await this.stats.getDashboard()
    return (
      <div class="wrap">
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <h1>Leads</h1>
        <div class="kpis">
          <KpiCard label="Total" value={data.total} />
          <KpiCard label="Nuevos 24h" value={data.new24h} />
        </div>
        <Section title="Por estado">
          <BarList items={data.byStatus} />
        </Section>
      </div>
    )
  }
}
```

The project runner discovers `@uiController` classes from the `directories` scan (`src/` by default); no manual registration.

## The kit

Imported from `@wabot-dev/framework/monitor`:

- **`KpiCard({ label, value, sub? })`** — a number + label card.
- **`BarList({ items: { name, count }[] })`** — horizontal bars, auto-scaled to the max; renders a placeholder when empty.
- **`Section({ title, children })`** — a titled panel.
- **`MonitorAuthMiddleware`** — the `?key=` guard (see Auth).

They are server-rendered Preact; no client JS ships. Lay the page out with an inline `<style dangerouslySetInnerHTML>` (CSS modules also work — see `wabot-ui`). To customize the look, copy the components into your app instead of importing the kit — they're ~30 lines total.

## Auth

`MonitorAuthMiddleware` reads `process.env.MONITOR_API_KEY` from the `?key=` query param — browser-friendly, since a navigation cannot send an `Authorization` header. If the env var is unset the route answers **500** (it will not silently expose data). One key guards every monitor that reuses the middleware.

For machine/API access (header `Authorization: api-key <secret>` validated against the `api_key` table), use the framework's `ApiKeyGuardMiddleware` from `@wabot-dev/framework` instead.

## Hard rules

- **Read-only.** Never `INSERT`/`UPDATE`/`DELETE` from a monitor repository. If you are mutating, it is not a monitor.
- **`try/catch` every query** and return a safe default (0 / `[]`). Tables are created lazily by other repositories; a monitor may run before one exists.
- **PG-only.** `Pool` is registered only when `DATABASE_URL` is set. In in-memory mode there is nothing to monitor.
- **Don't extend `PgCrudRepository` for aggregates.** Its `query()` builds entities, not counts. Use `pool.query` directly.
- **`?key=` for browsers**, not the `Authorization` header.
- UI decorators from `@wabot-dev/framework/ui`; kit + `MonitorAuthMiddleware` from `@wabot-dev/framework/monitor`. Never import from internal paths.

## Testing

`createUiHarness({ controllers, register? })` from `@wabot-dev/framework/testing` mounts the controller on an ephemeral server and runs the real pipeline (middlewares, validation, SSR). Register a fake service so the page renders against canned data:

```ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { createUiHarness } from '@wabot-dev/framework/testing'
import { LeadsMonitorController } from './LeadsMonitorController'
import { LeadsStatsService } from './LeadsStatsService'

const fake = {
  getDashboard: async () => ({ byStatus: [{ name: 'new', count: 5 }], new24h: 1, total: 5, generatedAt: 0 }),
} as unknown as LeadsStatsService

let harness: Awaited<ReturnType<typeof createUiHarness>>
test.before(async () => {
  process.env.MONITOR_API_KEY = 'k'
  harness = await createUiHarness({
    controllers: [LeadsMonitorController],
    register: [[LeadsStatsService, fake]],
  })
})
test.after(async () => {
  delete process.env.MONITOR_API_KEY
  await harness.close()
})

test('GET /leads-monitor sin key → 401', async () => {
  assert.equal((await harness.get('/leads-monitor')).status, 401)
})

test('con ?key → 200 y renderiza', async () => {
  const res = await harness.get('/leads-monitor', { query: { key: 'k' } })
  assert.equal(res.status, 200)
  assert.match(res.text, /Leads/)
})
```

For the repository SQL, write a `*.integration.test.ts` that seeds your tables and asserts the counts, skipped when `DATABASE_URL` is unset. Model it on `src/addon/monitor/MonitorStatsRepository.integration.test.ts`.
