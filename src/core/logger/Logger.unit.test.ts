import test, { afterEach } from 'node:test'
import assert from 'node:assert/strict'

import { Logger } from './Logger'
import { runWithLogContext } from './logContext'

/** Capture the JSON log lines written to stdout while `fn` runs. */
function captureJson(fn: () => void): any[] {
  const lines: string[] = []
  const original = process.stdout.write
  ;(process.stdout as any).write = (chunk: any) => {
    lines.push(String(chunk))
    return true
  }
  try {
    fn()
  } finally {
    ;(process.stdout as any).write = original
  }
  return lines.map((l) => JSON.parse(l))
}

test.describe('Logger (JSON output)', () => {
  afterEach(() => Logger.configure({ format: null, level: null }))

  test('emits a structured record with time / level / logger / message + extra', () => {
    Logger.configure({ format: 'json', level: 'info' })
    const [rec] = captureJson(() => new Logger('test:svc').info('started', { workers: 4 }))
    assert.equal(rec.level, 'info')
    assert.equal(rec.logger, 'test:svc')
    assert.equal(rec.message, 'started')
    assert.equal(rec.workers, 4)
    assert.ok(rec.time)
  })

  test('the level floor gates lower levels', () => {
    Logger.configure({ format: 'json', level: 'warn' })
    const log = new Logger('test:svc')
    assert.equal(captureJson(() => log.info('x')).length, 0)
    assert.equal(captureJson(() => log.warn('y')).length, 1)
  })

  test('includes the active log context for correlation', () => {
    Logger.configure({ format: 'json', level: 'info' })
    const [rec] = captureJson(() =>
      runWithLogContext({ requestId: 'req1', chatId: 'c9' }, () =>
        new Logger('test:svc').info('hi'),
      ),
    )
    assert.equal(rec.requestId, 'req1')
    assert.equal(rec.chatId, 'c9')
  })

  test('serializes an Error into `err`', () => {
    Logger.configure({ format: 'json', level: 'error' })
    const [rec] = captureJson(() => new Logger('test:svc').error('boom', new Error('kaboom')))
    assert.equal(rec.message, 'boom')
    assert.match(JSON.stringify(rec.err), /kaboom/)
  })

  test('with no floor and DEBUG off, nothing is emitted', () => {
    Logger.configure({ format: 'json', level: null })
    assert.equal(captureJson(() => new Logger('test:svc').info('quiet')).length, 0)
  })
})
