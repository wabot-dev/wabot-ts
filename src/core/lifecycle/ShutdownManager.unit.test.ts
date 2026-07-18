import test from 'node:test'
import assert from 'node:assert/strict'
import { Env } from '@/core/env'
import { ShutdownManager } from './ShutdownManager'

function managerWithTimeout(seconds: number): ShutdownManager {
  const env = { requireNumber: () => seconds } as unknown as Env
  return new ShutdownManager(env)
}

test.describe('ShutdownManager', () => {
  test('runs phases in order intake → drain → close', async () => {
    const manager = managerWithTimeout(30)
    const order: string[] = []

    manager.register({ name: 'c', phase: 'close', run: () => void order.push('close') })
    manager.register({ name: 'a', phase: 'intake', run: () => void order.push('intake') })
    manager.register({ name: 'b', phase: 'drain', run: () => void order.push('drain') })

    const code = await manager.shutdown('test')

    assert.equal(code, 0)
    assert.deepEqual(order, ['intake', 'drain', 'close'])
  })

  test('awaits async tasks before advancing to the next phase', async () => {
    const manager = managerWithTimeout(30)
    const order: string[] = []

    manager.register({
      name: 'slow-intake',
      phase: 'intake',
      run: async () => {
        await new Promise((r) => setTimeout(r, 30))
        order.push('intake')
      },
    })
    manager.register({ name: 'close', phase: 'close', run: () => void order.push('close') })

    await manager.shutdown('test')

    assert.deepEqual(order, ['intake', 'close'])
  })

  test('a failing task is isolated: the rest still run and exit code stays 0', async () => {
    const manager = managerWithTimeout(30)
    const ran: string[] = []

    manager.register({
      name: 'boom',
      phase: 'drain',
      run: () => {
        throw new Error('boom')
      },
    })
    manager.register({ name: 'ok', phase: 'drain', run: () => void ran.push('ok') })

    const code = await manager.shutdown('test')

    assert.equal(code, 0)
    assert.deepEqual(ran, ['ok'])
  })

  test('returns exit code 1 when a task exceeds the deadline', async () => {
    const manager = managerWithTimeout(0.05) // 50ms budget
    let cleared = false

    manager.register({
      name: 'hang',
      phase: 'drain',
      run: () => new Promise<void>(() => {}), // never resolves
    })
    manager.register({ name: 'after', phase: 'close', run: () => void (cleared = true) })

    const code = await manager.shutdown('test')

    assert.equal(code, 1)
    // The hung drain phase never completed, so the close phase never ran.
    assert.equal(cleared, false)
  })

  test('shutdown is idempotent: a second call is a no-op returning 0', async () => {
    const manager = managerWithTimeout(30)
    let runs = 0

    manager.register({ name: 'once', phase: 'intake', run: () => void runs++ })

    const first = await manager.shutdown('test')
    const second = await manager.shutdown('test')

    assert.equal(first, 0)
    assert.equal(second, 0)
    assert.equal(runs, 1)
    assert.equal(manager.isShuttingDown, true)
  })
})
