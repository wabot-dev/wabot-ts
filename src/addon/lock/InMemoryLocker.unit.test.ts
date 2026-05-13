import test from 'node:test'
import assert from 'node:assert/strict'
import { InMemoryLocker } from './InMemoryLocker'
import { ILockerKey } from '@/core/lock'

test.describe('InMemoryLocker', () => {
  test('withKey returns an InMemoryLockKey', () => {
    const locker = new InMemoryLocker()
    const key = locker.withKey('test')
    assert.ok(key)
    assert.equal(typeof key.run, 'function')
    assert.equal(typeof key.tryRun, 'function')
  })

  test('withKey accepts string key', async () => {
    const locker = new InMemoryLocker()
    const result = await locker.withKey('foo').run(async () => 'bar')
    assert.equal(result, 'bar')
  })

  test('withKey accepts number key', async () => {
    const locker = new InMemoryLocker()
    const result = await locker.withKey(42).run(async () => 'ok')
    assert.equal(result, 'ok')
  })

  test('withKey accepts ILockerKey object', async () => {
    const locker = new InMemoryLocker()
    const entity: ILockerKey = { lockerKey: () => 'entity-1' }
    const result = await locker.withKey(entity).run(async () => 'from-entity')
    assert.equal(result, 'from-entity')
  })

  test('run executes the function', async () => {
    const locker = new InMemoryLocker()
    const result = await locker.withKey('a').run(async () => 123)
    assert.equal(result, 123)
  })

  test('run returns the resolved value', async () => {
    const locker = new InMemoryLocker()
    const result = await locker.withKey('b').run(async () => 'hello')
    assert.equal(result, 'hello')
  })

  test('tryRun executes fn when lock is free', async () => {
    const locker = new InMemoryLocker()
    const result = await locker.withKey('free').tryRun(async () => 'acquired')
    assert.equal(result, 'acquired')
  })

  test('tryRun returns undefined when lock is held', async () => {
    const locker = new InMemoryLocker()
    const results: (string | undefined)[] = []

    await locker.withKey('contended').run(async () => {
      const r = await locker.withKey('contended').tryRun(async () => 'should-not-run')
      results.push(r)
    })

    assert.equal(results[0], undefined)
  })

  test('run serializes concurrent access to same key', async () => {
    const locker = new InMemoryLocker()
    const order: number[] = []

    await Promise.all([
      locker.withKey('same').run(async () => {
        order.push(1)
        await new Promise((r) => setTimeout(r, 10))
        order.push(2)
      }),
      locker.withKey('same').run(async () => {
        order.push(3)
        await new Promise((r) => setTimeout(r, 5))
        order.push(4)
      }),
    ])

    assert.deepEqual(order, [1, 2, 3, 4])
  })

  test('different keys run concurrently', async () => {
    const locker = new InMemoryLocker()
    const order: number[] = []

    await Promise.all([
      locker.withKey('x').run(async () => {
        await new Promise((r) => setTimeout(r, 10))
        order.push(1)
      }),
      locker.withKey('y').run(async () => {
        order.push(2)
      }),
    ])

    assert.deepEqual(order, [2, 1])
  })

  test('tryRun returns fn value when lock is free after previous release', async () => {
    const locker = new InMemoryLocker()

    await locker.withKey('seq').run(async () => 'first')
    const result = await locker.withKey('seq').tryRun(async () => 'second')

    assert.equal(result, 'second')
  })

  test('throws when fn throws', async () => {
    const locker = new InMemoryLocker()
    await assert.rejects(
      locker.withKey('fail').run(async () => {
        throw new Error('boom')
      }),
      { message: 'boom' },
    )
  })

  test('releases lock after fn throws', async () => {
    const locker = new InMemoryLocker()

    await assert.rejects(
      locker.withKey('fail-then-free').run(async () => {
        throw new Error('boom')
      }),
    )

    const result = await locker.withKey('fail-then-free').tryRun(async () => 'recovered')
    assert.equal(result, 'recovered')
  })

  test('tryRun releases lock after fn throws', async () => {
    const locker = new InMemoryLocker()

    await assert.rejects(
      locker.withKey('try-fail').tryRun(async () => {
        throw new Error('boom')
      }),
    )

    const result = await locker.withKey('try-fail').tryRun(async () => 'ok')
    assert.equal(result, 'ok')
  })

  test('nested run with different keys works', async () => {
    const locker = new InMemoryLocker()

    const result = await locker.withKey('outer').run(async () => {
      return await locker.withKey('inner').run(async () => 'nested')
    })

    assert.equal(result, 'nested')
  })

  test('nested tryRun with different keys works', async () => {
    const locker = new InMemoryLocker()

    const result = await locker.withKey('outer').run(async () => {
      return await locker.withKey('inner').tryRun(async () => 'nested-try')
    })

    assert.equal(result, 'nested-try')
  })
})
