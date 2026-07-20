import test from 'node:test'
import assert from 'node:assert/strict'

import { Env } from '@/core/env'
import { buildPgPoolConfig, PG_POOL_ENV } from './pgPoolConfig'

const KEYS = Object.values(PG_POOL_ENV)
const env = new Env()
const CS = 'postgres://u:p@localhost:5432/db'

// Run `fn` with only the given WABOT_PG_* vars set, restoring the environment after.
function withEnv(vars: Record<string, string>, fn: () => void): void {
  const saved: Record<string, string | undefined> = {}
  for (const key of KEYS) {
    saved[key] = process.env[key]
    delete process.env[key]
  }
  Object.assign(process.env, vars)
  try {
    fn()
  } finally {
    for (const key of KEYS) {
      if (saved[key] === undefined) delete process.env[key]
      else process.env[key] = saved[key]
    }
  }
}

test.describe('buildPgPoolConfig', () => {
  test('production-safe defaults when nothing is set', () => {
    withEnv({}, () => {
      const c = buildPgPoolConfig(CS, env)
      assert.equal(c.connectionString, CS)
      assert.equal(c.max, 10)
      assert.equal(c.min, 0)
      assert.equal(c.idleTimeoutMillis, 10_000)
      // finite connect timeout instead of pg's default "wait forever"
      assert.equal(c.connectionTimeoutMillis, 10_000)
      assert.equal(c.application_name, 'wabot')
      // optional caps stay off unless requested
      assert.equal('maxLifetimeSeconds' in c, false)
      assert.equal('statement_timeout' in c, false)
    })
  })

  test('reads overrides from WABOT_PG_* env vars', () => {
    withEnv(
      {
        [PG_POOL_ENV.max]: '25',
        [PG_POOL_ENV.min]: '2',
        [PG_POOL_ENV.idleTimeoutMs]: '5000',
        [PG_POOL_ENV.connectionTimeoutMs]: '3000',
        [PG_POOL_ENV.appName]: 'orders-api',
      },
      () => {
        const c = buildPgPoolConfig(CS, env)
        assert.equal(c.max, 25)
        assert.equal(c.min, 2)
        assert.equal(c.idleTimeoutMillis, 5000)
        assert.equal(c.connectionTimeoutMillis, 3000)
        assert.equal(c.application_name, 'orders-api')
      },
    )
  })

  test('maxLifetime / statement_timeout are included only when > 0', () => {
    withEnv(
      {
        [PG_POOL_ENV.maxLifetimeSeconds]: '900',
        [PG_POOL_ENV.statementTimeoutMs]: '30000',
      },
      () => {
        const c = buildPgPoolConfig(CS, env)
        assert.equal(c.maxLifetimeSeconds, 900)
        assert.equal(c.statement_timeout, 30000)
      },
    )
  })

  test('an explicit 0 keeps the optional caps omitted', () => {
    withEnv(
      {
        [PG_POOL_ENV.maxLifetimeSeconds]: '0',
        [PG_POOL_ENV.statementTimeoutMs]: '0',
      },
      () => {
        const c = buildPgPoolConfig(CS, env)
        assert.equal('maxLifetimeSeconds' in c, false)
        assert.equal('statement_timeout' in c, false)
      },
    )
  })

  test('a non-numeric pool size fails fast, naming the env var', () => {
    withEnv({ [PG_POOL_ENV.max]: 'lots' }, () => {
      assert.throws(() => buildPgPoolConfig(CS, env), /WABOT_PG_POOL_MAX/)
    })
  })

  test('per-database overrides win over env vars and defaults', () => {
    withEnv({ [PG_POOL_ENV.max]: '50', [PG_POOL_ENV.appName]: 'from-env' }, () => {
      const c = buildPgPoolConfig(CS, env, {
        max: 5,
        applicationName: 'wabot:db1',
        statementTimeoutMs: 15000,
      })
      assert.equal(c.max, 5, 'override beats the env var')
      assert.equal(c.application_name, 'wabot:db1')
      assert.equal(c.statement_timeout, 15000)
      // untouched knobs still fall back to env/default
      assert.equal(c.idleTimeoutMillis, 10_000)
    })
  })
})
