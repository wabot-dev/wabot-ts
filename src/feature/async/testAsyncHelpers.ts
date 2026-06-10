import { Entity, IEntityData } from '@/core/entity'
import { ChildProcess, spawn } from 'node:child_process'

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
export { wait, waitUntil, isValidCronSequence } from '@/testing/helpers'
export type { ICronValidationOptions } from '@/testing/helpers'

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
