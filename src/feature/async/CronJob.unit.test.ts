import test from 'node:test'
import assert from 'node:assert/strict'
import { CronJob } from './CronJob'

test.describe('CronJob', () => {
  test('due cron job', () => {
    const now = new Date()

    const cron = new CronJob({
      name: 'cron-1',
      commandName: 'test',
      commandData: {},
      cron: '* * * * *',
      enabled: true,
      nextRunAt: now.getTime() - 1000,
    })

    assert.equal(cron.isDue(now), true)
  })

  test('disabled cron job is never due', () => {
    const now = new Date()

    const cron = new CronJob({
      name: 'cron-1',
      commandName: 'test',
      commandData: {},
      cron: '* * * * *',
      enabled: false,
      nextRunAt: now.getTime() - 1000,
    })

    assert.equal(cron.isDue(now), false)
  })

  test('computeNextRun() sets future nextRunAt', () => {
    const now = new Date()

    const cron = new CronJob({
      name: 'cron-1',
      commandName: 'test',
      commandData: {},
      cron: '* * * * *',
      enabled: true,
      nextRunAt: now.getTime(),
    })

    cron.computeNextRun(now)

    assert.ok(cron.nextRunAt, 'nextRunAt should be in the future')
    assert.ok(cron.nextRunAt.getTime() > now.getTime(), 'nextRunAt should be in the future')
  })

  test('markAsExecuted() updates lastRunAt and nextRunAt', () => {
    const now = new Date()

    const cron = new CronJob({
      name: 'cron-1',
      commandName: 'test',
      commandData: {},
      cron: '* * * * *',
      enabled: true,
      nextRunAt: now.getTime(),
    })

    cron.markAsExecuted(now)

    assert.equal(cron.lastRunAt?.getTime(), now.getTime())
    assert.ok(cron.nextRunAt, 'nextRunAt should advance after execution')
    assert.ok(cron.nextRunAt.getTime() > now.getTime(), 'nextRunAt should advance after execution')
  })

  test('nextJob() creates a schedulable Job', () => {
    const now = Date.now()

    const cron = new CronJob({
      name: 'cron-1',
      commandName: 'test',
      commandData: { a: 1 },
      cron: '* * * * *',
      enabled: true,
      nextRunAt: now - 1000,

      reintentsDelaysInSeconds: [10],
      aceptableRunningTimeSeconds: 5,
      stuckRetryAttempts: 3,
    })

    const job = cron.nextJob()

    assert.equal(job.commandName, 'test')
    assert.deepEqual(job.commandData, { a: 1 })

    assert.equal(job.isScheduleReady(), true)
    assert.equal(job.isRunning(), false)
    assert.equal(job.hasFinished(), false)

    // Retry / recovery config propagated
    assert.deepEqual(job.reintentsDelaysInSeconds, [10])
    assert.equal(job.aceptableRunningTimeSeconds, 5)
    assert.equal(job.stuckRetryAttempts, 3)
  })

  test('default maxConcurrency and misfirePolicy', () => {
    const cron = new CronJob({
      name: 'cron-1',
      commandName: 'cron:test',
      commandData: {},
      cron: '* * * * *',
      enabled: true,
      nextRunAt: Date.now(),
    })

    assert.equal(cron.maxConcurrency, 1)
    assert.equal(cron.misfirePolicy, 'RUN_ONCE')
  })
})
