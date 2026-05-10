import test from 'node:test'
import assert from 'node:assert/strict'
import { str, num, bool, obj, strArr, numArr, boolArr, resolveConfigReferences } from '../index'

test.describe('ConfigLoader', () => {
  const originalEnv = { ...process.env }

  test.beforeEach(() => {
    process.env = { ...originalEnv }
  })

  test.afterEach(() => {
    process.env = { ...originalEnv }
  })

  test.describe('str - String tag function', () => {
    test('should resolve string config from env', () => {
      process.env.TELEGRAM_TOKEN = 'abc123'
      const config = { token: str`telegram.token` }
      const resolved = resolveConfigReferences(config)
      assert.equal(resolved.token, 'abc123')
    })

    test('should throw when string config is missing', () => {
      delete process.env.TELEGRAM_TOKEN
      const config = { token: str`telegram.token` }
      assert.throws(() => resolveConfigReferences(config), /Config not found/)
    })

    test('should use default when config is missing', () => {
      delete process.env.TELEGRAM_TOKEN
      const config = { token: str`telegram.token:default-token` }
      const resolved = resolveConfigReferences(config)
      assert.equal(resolved.token, 'default-token')
    })
  })

  test.describe('num - Number tag function', () => {
    test('should resolve and coerce number config', () => {
      process.env.TELEGRAM_TIMEOUT = '5000'
      const config = { timeout: num`telegram.timeout` }
      const resolved = resolveConfigReferences(config)
      assert.equal(resolved.timeout, 5000)
      assert.equal(typeof resolved.timeout, 'number')
    })

    test('should use default number', () => {
      delete process.env.TELEGRAM_TIMEOUT
      const config = { timeout: num`telegram.timeout:3000` }
      const resolved = resolveConfigReferences(config)
      assert.equal(resolved.timeout, 3000)
    })

    test('should throw for invalid number', () => {
      process.env.TELEGRAM_TIMEOUT = 'invalid'
      const config = { timeout: num`telegram.timeout` }
      assert.throws(() => resolveConfigReferences(config), /Cannot coerce/)
    })
  })

  test.describe('bool - Boolean tag function', () => {
    test('should resolve true values', () => {
      process.env.DEBUG_ENABLED = 'true'
      const config = { debug: bool`debug.enabled` }
      const resolved = resolveConfigReferences(config)
      assert.equal(resolved.debug, true)
    })

    test('should resolve false values', () => {
      process.env.DEBUG_ENABLED = 'false'
      const config = { debug: bool`debug.enabled` }
      const resolved = resolveConfigReferences(config)
      assert.equal(resolved.debug, false)
    })

    test('should handle 1 and 0', () => {
      process.env.ENABLED = '1'
      const config1 = { enabled: bool`enabled` }
      assert.equal(resolveConfigReferences(config1).enabled, true)

      process.env.ENABLED = '0'
      const config2 = { enabled: bool`enabled` }
      assert.equal(resolveConfigReferences(config2).enabled, false)
    })

    test('should handle yes/no', () => {
      process.env.ENABLED = 'yes'
      const config1 = { enabled: bool`enabled` }
      assert.equal(resolveConfigReferences(config1).enabled, true)

      process.env.ENABLED = 'no'
      const config2 = { enabled: bool`enabled` }
      assert.equal(resolveConfigReferences(config2).enabled, false)
    })

    test('should be case insensitive', () => {
      process.env.ENABLED = 'TRUE'
      const config = { enabled: bool`enabled` }
      assert.equal(resolveConfigReferences(config).enabled, true)
    })

    test('should use default boolean', () => {
      delete process.env.DEBUG_ENABLED
      const config = { debug: bool`debug.enabled:true` }
      const resolved = resolveConfigReferences(config)
      assert.equal(resolved.debug, true)
    })
  })

  test.describe('obj - Object tag function', () => {
    test('should resolve and parse JSON object', () => {
      process.env.TELEGRAM_METADATA = '{"key":"value","count":42}'
      const config = { metadata: obj`telegram.metadata` }
      const resolved = resolveConfigReferences(config)
      assert.deepEqual(resolved.metadata, { key: 'value', count: 42 })
    })

    test('should use default object', () => {
      delete process.env.TELEGRAM_METADATA
      const config = { metadata: obj`telegram.metadata:{}` }
      const resolved = resolveConfigReferences(config)
      assert.deepEqual(resolved.metadata, {})
    })

    test('should throw for invalid JSON', () => {
      process.env.TELEGRAM_METADATA = '{invalid json}'
      const config = { metadata: obj`telegram.metadata` }
      assert.throws(() => resolveConfigReferences(config), /Cannot coerce/)
    })
  })

  test.describe('resolveConfigReferences - Mixed config', () => {
    test('should resolve multiple configs of different types', () => {
      process.env.TELEGRAM_TOKEN = 'abc123'
      process.env.TELEGRAM_TIMEOUT = '5000'
      process.env.TELEGRAM_DEBUG = 'true'

      const config = {
        token: str`telegram.token`,
        timeout: num`telegram.timeout`,
        debug: bool`telegram.debug`,
        metadata: obj`telegram.metadata:{}`,
      }

      const resolved = resolveConfigReferences(config)

      assert.equal(resolved.token, 'abc123')
      assert.equal(resolved.timeout, 5000)
      assert.equal(resolved.debug, true)
      assert.deepEqual(resolved.metadata, {})
    })

    test('should skip non-config-reference values', () => {
      process.env.TOKEN = 'env-token'
      const config = {
        token: str`token`,
        hardcoded: 'literal-value',
        number: 42,
      }
      const resolved = resolveConfigReferences(config)
      assert.equal(resolved.token, 'env-token')
      assert.equal(resolved.hardcoded, 'literal-value')
      assert.equal(resolved.number, 42)
    })
  })

  test.describe('Path to env var conversion', () => {
    test('should convert dot notation to underscores', () => {
      process.env.MY_SERVICE_API_KEY = 'secret'
      const config = { key: str`my.service.api.key` }
      const resolved = resolveConfigReferences(config)
      assert.equal(resolved.key, 'secret')
    })

    test('should uppercase the path', () => {
      process.env.LOWER_CASE_PATH = 'value'
      const config = { val: str`lower.case.path` }
      const resolved = resolveConfigReferences(config)
      assert.equal(resolved.val, 'value')
    })
  })

  test.describe('Defaults containing colons', () => {
    test('should preserve colons in string default (URL)', () => {
      delete process.env.DB_URL
      const config = { url: str`db.url:postgres://user:pass@host:5432/db` }
      const resolved = resolveConfigReferences(config)
      assert.equal(resolved.url, 'postgres://user:pass@host:5432/db')
    })

    test('should preserve colons in object default (JSON)', () => {
      delete process.env.APP_META
      const config = { meta: obj`app.meta:{"key":"value","nested":{"a":1}}` }
      const resolved = resolveConfigReferences(config)
      assert.deepEqual(resolved.meta, { key: 'value', nested: { a: 1 } })
    })
  })

  test.describe('Empty-string env vars', () => {
    test('should treat empty string as unset and fall back to default', () => {
      process.env.TELEGRAM_TIMEOUT = ''
      const config = { timeout: num`telegram.timeout:5000` }
      const resolved = resolveConfigReferences(config)
      assert.equal(resolved.timeout, 5000)
    })

    test('should treat empty string as missing and throw without default', () => {
      process.env.TELEGRAM_TOKEN = ''
      const config = { token: str`telegram.token` }
      assert.throws(() => resolveConfigReferences(config), /Config not found/)
    })
  })

  test.describe('strArr - String array tag function', () => {
    test('should parse CSV from env', () => {
      process.env.TAGS = 'foo,bar,baz'
      const config = { tags: strArr`tags` }
      const resolved = resolveConfigReferences(config)
      assert.deepEqual(resolved.tags, ['foo', 'bar', 'baz'])
    })

    test('should trim whitespace and drop empty CSV items', () => {
      process.env.TAGS = ' foo ,, bar ,  '
      const config = { tags: strArr`tags` }
      const resolved = resolveConfigReferences(config)
      assert.deepEqual(resolved.tags, ['foo', 'bar'])
    })

    test('should parse JSON array from env', () => {
      process.env.TAGS = '["foo","bar with, comma","baz"]'
      const config = { tags: strArr`tags` }
      const resolved = resolveConfigReferences(config)
      assert.deepEqual(resolved.tags, ['foo', 'bar with, comma', 'baz'])
    })

    test('should use CSV default', () => {
      delete process.env.TAGS
      const config = { tags: strArr`tags:foo,bar` }
      const resolved = resolveConfigReferences(config)
      assert.deepEqual(resolved.tags, ['foo', 'bar'])
    })

    test('should use JSON default', () => {
      delete process.env.TAGS
      const config = { tags: strArr`tags:["a","b","c"]` }
      const resolved = resolveConfigReferences(config)
      assert.deepEqual(resolved.tags, ['a', 'b', 'c'])
    })

    test('should throw if JSON value is not an array', () => {
      process.env.TAGS = '{"not":"array"}'
      const config = { tags: strArr`tags` }
      assert.throws(() => resolveConfigReferences(config), /Cannot coerce|Expected JSON array/)
    })
  })

  test.describe('numArr - Number array tag function', () => {
    test('should parse and coerce CSV numbers', () => {
      process.env.PORTS = '80,443,8080'
      const config = { ports: numArr`ports` }
      const resolved = resolveConfigReferences(config)
      assert.deepEqual(resolved.ports, [80, 443, 8080])
    })

    test('should parse and coerce JSON numbers', () => {
      process.env.PORTS = '[80,443,8080]'
      const config = { ports: numArr`ports` }
      const resolved = resolveConfigReferences(config)
      assert.deepEqual(resolved.ports, [80, 443, 8080])
    })

    test('should throw on non-numeric CSV item', () => {
      process.env.PORTS = '80,not-a-number,8080'
      const config = { ports: numArr`ports` }
      assert.throws(() => resolveConfigReferences(config), /Cannot coerce/)
    })

    test('should use CSV default', () => {
      delete process.env.PORTS
      const config = { ports: numArr`ports:80,443` }
      const resolved = resolveConfigReferences(config)
      assert.deepEqual(resolved.ports, [80, 443])
    })
  })

  test.describe('boolArr - Boolean array tag function', () => {
    test('should parse CSV booleans', () => {
      process.env.FLAGS = 'true,false,1,0,yes,no'
      const config = { flags: boolArr`flags` }
      const resolved = resolveConfigReferences(config)
      assert.deepEqual(resolved.flags, [true, false, true, false, true, false])
    })

    test('should parse JSON booleans', () => {
      process.env.FLAGS = '[true,false,true]'
      const config = { flags: boolArr`flags` }
      const resolved = resolveConfigReferences(config)
      assert.deepEqual(resolved.flags, [true, false, true])
    })

    test('should use default', () => {
      delete process.env.FLAGS
      const config = { flags: boolArr`flags:true,false` }
      const resolved = resolveConfigReferences(config)
      assert.deepEqual(resolved.flags, [true, false])
    })
  })

  test.describe('Template interpolation', () => {
    test('should reject interpolated templates at runtime', () => {
      const fakeStrings = Object.assign(['telegram.', ''], { raw: ['telegram.', ''] })
      const callWithInterpolation = str as unknown as (
        s: TemplateStringsArray,
        ...v: unknown[]
      ) => unknown
      assert.throws(
        () => callWithInterpolation(fakeStrings as TemplateStringsArray, 'token'),
        /interpolation/,
      )
    })
  })
})
