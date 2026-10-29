import test from 'node:test'
import assert from 'node:assert/strict'
import { AsyncLocalStorage } from 'node:async_hooks'

import { clearOnDetach } from '@/core/async-scope'
import type { Env } from '@/core/env'
import type { Locker } from '@/core/lock'
import { Job } from './Job'
import { JobExecutor } from './JobExecutor'
import type { JobRepository } from './JobRepository'
import type { JobRunner } from './JobRunner'

// Stands in for a backend's per-scope connection, like the client withPgClient keeps.
const connection = new AsyncLocalStorage<string>()
clearOnDetach((fn) => connection.exit(fn))

function pendingJob() {
  return new Job({ id: 'job-1', commandName: 'test', commandData: {}, scheduledAt: Date.now() })
}

// An executor whose collaborators record the connection each step ran on.
function fakeExecutor(stored: Job | null) {
  const steps: [string, string | undefined][] = []
  const locker = {
    withKey: () => ({
      tryRun: (fn: () => Promise<unknown>) => {
        steps.push(['lock', connection.getStore()])
        return fn()
      },
    }),
  }
  const runner = {
    run: async () => void steps.push(['run', connection.getStore()]),
  }
  const repo = {
    find: async () => stored,
    findOrThrow: async () => stored,
    update: async () => void steps.push(['update', connection.getStore()]),
  }
  const env = { requireNumber: () => 5 }

  const executor = new JobExecutor(
    locker as unknown as Locker,
    runner as unknown as JobRunner,
    repo as unknown as JobRepository,
    env as unknown as Env,
  )
  return { executor, steps }
}

test('a job does not run on the connection of whatever started it', async () => {
  // Like the scheduler loop, which starts jobs while it holds its lock.
  const job = pendingJob()
  const { executor, steps } = fakeExecutor(job)

  await connection.run('scheduler-lock', async () => {
    await executor.execute(job)
    assert.equal(connection.getStore(), 'scheduler-lock')
  })

  assert.deepEqual(steps, [
    ['lock', undefined],
    ['run', undefined],
  ])
})

test('a job its dispatcher has not committed yet is left for the scheduler', async () => {
  const { executor, steps } = fakeExecutor(null)

  await executor.execute(pendingJob())

  assert.deepEqual(steps, [['lock', undefined]])
  assert.equal(executor.remainingSlots(), 5)
})
