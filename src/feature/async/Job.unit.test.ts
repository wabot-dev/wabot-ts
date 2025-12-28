import test from 'node:test'
import assert from 'node:assert/strict'
import { Job } from './Job'

test.describe('Job', () => {
  test('schedule readiness', () => {
    const now = Date.now()

    const job = new Job({
      id: '1',
      commandName: 'test',
      commandData: {},
      scheduledAt: now - 1000,
    })

    assert.equal(job.isScheduleReady(), true)
  })

  test('setAsStarted()', () => {
    const now = Date.now()

    const job = new Job({
      id: '1',
      commandName: 'test',
      commandData: {},
      scheduledAt: now,
    })

    job.setAsStarted()

    assert.equal(job.hasStarted(), true)
    assert.equal(job.isRunning(), true)
    assert.equal(job.intentNumber, 0)
  })

  test('success finishes job', () => {
    const job = new Job({
      id: '1',
      commandName: 'test',
      commandData: {},
      scheduledAt: Date.now(),
      startedAt: Date.now(),
    })

    job.setAsSuccess()

    assert.equal(job.hasFinished(), true)
    assert.ok(job.successAt)
  })

  test('failure schedules retry', () => {
    const now = Date.now()

    const job = new Job({
      id: '1',
      commandName: 'test',
      commandData: {},
      scheduledAt: now,
      startedAt: now,
      intentNumber: 0,
      reintentsDelaysInSeconds: [10],
    })

    job.setAsFailed(new Error('boom'))

    assert.ok(job.failedAt)
    assert.ok(job.scheduledAt && job.scheduledAt.getTime() > now)
  })

  test('recover stuck job', () => {
    const job = new Job({
      id: '1',
      commandName: 'test',
      commandData: {},
      startedAt: Date.now() - 2000,
      aceptableRunningTimeSeconds: 1,
      intentNumber: 0,
      stuckRetryAttempts: 2,
    })

    job.recover()

    assert.equal(job.isRunning(), false)
    assert.ok(job.scheduledAt) // rescheduled
  })
})
