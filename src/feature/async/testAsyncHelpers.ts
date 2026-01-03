import { Entity, IEntityData } from '@/core/entity'
import { ChildProcess, spawn } from 'node:child_process'
import { CronExpressionParser } from 'cron-parser'

//----------------------- Repositories ------------------------
interface ITestTagData extends IEntityData {
  value: string
}

export class TestTag extends Entity<ITestTagData> {
  get value() {
    return this.data.value
  }
}

export interface ITestTagRepository {
  create(item: TestTag): Promise<void>
  findByValue(value: string): Promise<TestTag[]>
}

export class TestTagRepository implements ITestTagRepository {
  create(item: TestTag): Promise<void> {
    throw new Error('Method not implemented.')
  }
  findByValue(
    value: string,
    options?: { limit: number; order: 'asc' | 'desc' },
  ): Promise<TestTag[]> {
    throw new Error('Method not implemented.')
  }
}

//--------------------------- Helpers --------------------------
export async function waitUntil(
  condition: () => Promise<boolean>,
  timeoutMs = 5000,
  intervalMs = 50,
) {
  const start = Date.now()

  while (Date.now() - start < timeoutMs) {
    if (await condition()) return
    await new Promise((r) => setTimeout(r, intervalMs))
  }

  throw new Error('Condition not met within timeout')
}

export async function wait(timeoutMs = 5000) {
  await new Promise((r) => setTimeout(r, timeoutMs))
}

let workers: ChildProcess[] = []

interface IrunWorkersReq {
  workerPath: string
  numberOfWorkers: number
  localRun?: boolean
}

export function runAsyncWorkers({ workerPath, numberOfWorkers }: IrunWorkersReq) {
  const env = {
    DATABASE_URL: process.env.DATABASE_URL,
    DEBUG: process.env.DEBUG,
    WABOT_JOB_SCHEDULER_INTERVAL_SECONDS: process.env.WABOT_JOB_SCHEDULER_INTERVAL_SECONDS,
    WABOT_JOB_WATCHDOG_INTERVAL_SECONDS: process.env.WABOT_JOB_WATCHDOG_INTERVAL_SECONDS,
    WABOT_JOB_EXECUTOR_MAX_CONCURRENT_JOBS: process.env.WABOT_JOB_EXECUTOR_MAX_CONCURRENT_JOBS,
    WABOT_CRON_SCHEDULER_INTERVAL_SECONDS: process.env.WABOT_CRON_SCHEDULER_INTERVAL_SECONDS,
  }

  const nodeArgs = [...process.execArgv, workerPath]

  for (let i = workers.length; i < numberOfWorkers; i++) {
    workers.push(spawn(process.execPath, nodeArgs, { env, stdio: 'inherit' }))
  }
}

export function stopAsyncWorkers() {
  for (let i = 0; i < workers.length; i++) {
    workers[i].kill()
  }
  workers = []
}

export interface ICronValidationOptions {
  timezone?: string
  toleranceMs?: number // allowed drift in milliseconds
}

export function isValidCronSequence(
  cronExpression: string,
  dates: Date[],
  options: ICronValidationOptions = {},
): boolean {
  if (dates.length < 2) return false

  const {
    timezone = 'UTC',
    toleranceMs = 1000, // default 1 second tolerance
  } = options

  try {
    const interval = CronExpressionParser.parse(cronExpression, {
      currentDate: dates[0],
      tz: timezone,
    })

    for (let i = 1; i < dates.length; i++) {
      const expected = interval.next().toDate()
      const actual = dates[i]

      const diff = Math.abs(expected.getTime() - actual.getTime())

      if (diff > toleranceMs) {
        return false
      }
    }

    return true
  } catch {
    return false
  }
}
