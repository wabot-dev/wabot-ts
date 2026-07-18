import test, { afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { Logger } from '@/core/logger'
import type { IErrorMonitor } from '@/core/logger/IErrorMonitor'
import { flushErrorMonitor, handleFatal } from './setupCrashHandlers'

const logger = new Logger('test:crash')

function useMonitor(overrides: Partial<IErrorMonitor> = {}): { errors: Error[] } {
  const errors: Error[] = []
  const monitor: IErrorMonitor = {
    captureError: (e) => void errors.push(e),
    captureMessage: () => {},
    ...overrides,
  }
  Logger.setMonitor(monitor)
  return { errors }
}

test.describe('setupCrashHandlers', () => {
  // Logger.monitor is a static; reset it so these tests never leak into the
  // rest of the suite.
  afterEach(() => Logger.setMonitor(null as unknown as IErrorMonitor))

  test('exits with code 1 when shouldExit is true', async () => {
    let code: number | undefined
    await handleFatal(new Error('boom'), {
      label: 'Uncaught Exception',
      logger,
      exit: (c) => void (code = c),
      flushTimeoutMs: 50,
      shouldExit: true,
    })
    assert.equal(code, 1)
  })

  test('does not exit when shouldExit is false', async () => {
    let exited = false
    await handleFatal(new Error('boom'), {
      label: 'Unhandled Rejection',
      logger,
      exit: () => void (exited = true),
      flushTimeoutMs: 50,
      shouldExit: false,
    })
    assert.equal(exited, false)
  })

  test('wraps non-Error reasons and captures them to the monitor', async () => {
    const { errors } = useMonitor()
    await handleFatal('string reason', {
      label: 'Unhandled Rejection',
      logger,
      exit: () => {},
      flushTimeoutMs: 50,
      shouldExit: false,
    })
    assert.equal(errors.length, 1)
    assert.ok(errors[0] instanceof Error)
    assert.match(errors[0].message, /string reason/)
  })

  test('flushes the monitor before exiting', async () => {
    const events: string[] = []
    useMonitor({ flush: async () => void events.push('flush') })
    await handleFatal(new Error('x'), {
      label: 'Uncaught Exception',
      logger,
      exit: () => void events.push('exit'),
      flushTimeoutMs: 100,
      shouldExit: true,
    })
    assert.deepEqual(events, ['flush', 'exit'])
  })

  test('flushErrorMonitor is bounded when flush hangs', async () => {
    useMonitor({ flush: () => new Promise<void>(() => {}) }) // never resolves
    const start = Date.now()
    await flushErrorMonitor(60)
    const elapsed = Date.now() - start
    assert.ok(elapsed >= 50 && elapsed < 1000, `elapsed=${elapsed}ms`)
  })

  test('flushErrorMonitor swallows flush errors', async () => {
    useMonitor({
      flush: async () => {
        throw new Error('flush failed')
      },
    })
    await flushErrorMonitor(100) // must not throw
  })

  test('flushErrorMonitor resolves immediately without a monitor', async () => {
    const start = Date.now()
    await flushErrorMonitor(1000)
    assert.ok(Date.now() - start < 100)
  })
})
