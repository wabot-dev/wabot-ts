import test from 'node:test'
import assert from 'node:assert/strict'

import { ConfigError, findConfigError, formatConfigErrorReport } from './ConfigError'
import { ConfigResolver } from './resolver'
import { num, str } from './tag-functions'

test.describe('ConfigError', () => {
  const catchError = (fn: () => unknown): unknown => {
    try {
      fn()
    } catch (err) {
      return err
    }
    return undefined
  }

  test('resolve throws a ConfigError with path + envVar when missing', () => {
    delete process.env.MISSING_VAR
    const err = catchError(() => ConfigResolver.resolve(str`missing.var`))
    assert.ok(err instanceof ConfigError)
    assert.equal(err.path, 'missing.var')
    assert.equal(err.envVar, 'MISSING_VAR')
    assert.match(err.message, /Config not found/)
  })

  test('resolve throws a ConfigError on coercion failure, message preserved', () => {
    process.env.BAD_NUM = 'not-a-number'
    try {
      const err = catchError(() => ConfigResolver.resolve(num`bad.num`))
      assert.ok(err instanceof ConfigError)
      assert.equal(err.envVar, 'BAD_NUM')
      assert.match(err.message, /Cannot coerce/)
    } finally {
      delete process.env.BAD_NUM
    }
  })

  test('findConfigError finds it directly, via cause chain, or returns undefined', () => {
    const configError = new ConfigError('x', 'p', 'E')
    assert.equal(findConfigError(configError), configError)
    assert.equal(findConfigError(new Error('wrap', { cause: configError })), configError)
    assert.equal(findConfigError(new Error('plain')), undefined)
    assert.equal(findConfigError('a string'), undefined)
  })

  test('formatConfigErrorReport aggregates and dedups by env var', () => {
    const report = formatConfigErrorReport([
      new ConfigError('Config not found: a', 'a', 'A'),
      new ConfigError('Config not found: b', 'b', 'B'),
      new ConfigError('Config not found: a', 'a', 'A'),
    ])
    assert.match(report, /A \(config: a\)/)
    assert.match(report, /B \(config: b\)/)
    assert.equal(report.match(/config: a\)/g)?.length, 1) // deduped
  })
})
