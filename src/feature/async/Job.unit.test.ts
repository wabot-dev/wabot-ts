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
    assert.equal(job.isRunning(), false)
    assert.equal(job.hasFinished(), false)
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

    assert.equal(job.isScheduleReady(), false)
    assert.equal(job.isRunning(), true)
    assert.equal(job.hasFinished(), false)
    assert.equal(job.intentNumber, 0)
  })

  test('success finishes job', () => {
    const job = new Job({
      id: '1',
      commandName: 'test',
      commandData: {},
      scheduledAt: Date.now(),
      startedAt: Date.now(),
      intentNumber: 0,
    })

    job.setAsSuccess()

    assert.equal(job.isScheduleReady(), false)
    assert.equal(job.isRunning(), false)
    assert.equal(job.hasFinished(), true)
    assert.equal(job.wasSuccess(), true)
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

    assert.ok(job.scheduledAt && job.scheduledAt.getTime() >= now, 'job scheduledAt should be set')
    assert.equal(job.isRunning(), false, 'job is already running')
    assert.equal(job.wasFailed(), false, 'job was failed')
  })

  test('failure without retry', () => {
    const now = Date.now()

    const job = new Job({
      id: '1',
      commandName: 'test',
      commandData: {},
      scheduledAt: now,
      startedAt: now,
      intentNumber: 0,
    })

    job.setAsFailed(new Error('boom'))

    assert.equal(job.isScheduleReady(), false)
    assert.equal(job.isRunning(), false)
    assert.equal(job.wasFailed(), true)
    assert.equal(job.hasFinished(), true)
  })

  test('recover stuck job', () => {
    const job = new Job({
      id: '1',
      commandName: 'test',
      commandData: {},
      scheduledAt: Date.now() - 2500,
      startedAt: Date.now() - 2000,
      aceptableRunningTimeSeconds: 1,
      intentNumber: 0,
      stuckRetryAttempts: 2,
    })

    job.recover()

    assert.equal(job.isScheduleReady(), true)
    assert.equal(job.isRunning(), false)
    assert.equal(job.wasFailed(), false)
    assert.equal(job.hasFinished(), false)
  })
})
