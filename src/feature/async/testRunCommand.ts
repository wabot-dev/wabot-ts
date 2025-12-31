import { command } from './@command'
import { commandHandler } from './@commandHandler'
import { runCommandHandlers, stopCommandHandlers } from './runCommandHandlers'
import test, { after, before } from 'node:test'
import { container } from '@/core/injection'
import { JobRepository } from './JobRepository'
import { Async } from './Async'
import { ChildProcess, spawn } from 'node:child_process'
import { Entity, IEntityData } from '@/core/entity'
import { Random } from '@/core/random'
import assert from 'node:assert'

import { isString } from '@/core/validation'

//----------------------- Repositories ------------------------
interface ITagData extends IEntityData {
  value: string
}

export class Tag extends Entity<ITagData> {
  get value() {
    return this.data.value
  }
}

export interface ITagRepository {
  create(item: Tag): Promise<void>
  findByValue(value: string): Promise<Tag[]>
}

export class TagRepository implements ITagRepository {
  create(item: Tag): Promise<void> {
    throw new Error('Method not implemented.')
  }
  findByValue(value: string): Promise<Tag[]> {
    throw new Error('Method not implemented.')
  }
}

//-----------------------  Commands ----------------------

@command('save-tag')
class SaveTag {
  @isString()
  value!: string
}

@commandHandler(SaveTag)
class SaveTagHandler {
  constructor(private tagRepository: TagRepository) {}

  async handle({ value }: SaveTag) {
    const tag = new Tag({ value })
    await this.tagRepository.create(tag)
  }
}

//-----------------------  Workers ---------------------------

const commandHandlers = [SaveTagHandler]

export function runCommandsWorker() {
  runCommandHandlers(commandHandlers)
}

export function stopCommandsWorker() {
  stopCommandHandlers(commandHandlers)
}

//--------------------------- Helpers --------------------------
async function waitUntil(condition: () => Promise<boolean>, timeoutMs = 5000, intervalMs = 50) {
  const start = Date.now()

  while (Date.now() - start < timeoutMs) {
    if (await condition()) return
    await new Promise((r) => setTimeout(r, intervalMs))
  }

  throw new Error('Condition not met within timeout')
}

async function wait(timeoutMs = 5000) {
  await new Promise((r) => setTimeout(r, timeoutMs))
}

interface IrunWorkersReq {
  workerPath: string
  numberOfWorkers: number
  localRun?: boolean
}

let workers: ChildProcess[] = []
let localWorkerRunning = false

function runWorkers({ workerPath, numberOfWorkers, localRun }: IrunWorkersReq) {
  const env = {
    DATABASE_URL: process.env.DATABASE_URL,
    DEBUG: process.env.DEBUG,
    WABOT_JOB_SCHEDULER_INTERVAL_SECONDS: '1',
    WABOT_JOB_WATCHDOG_INTERVAL_SECONDS: '1',
    WABOT_JOB_EXECUTOR_MAX_CONCURRENT_JOBS: '2',
  }

  const nodeArgs = [...process.execArgv, workerPath]

  for (let i = workers.length; i < numberOfWorkers; i++) {
    workers.push(spawn(process.execPath, nodeArgs, { env, stdio: 'inherit' }))
  }

  if (localRun) {
    localWorkerRunning = true
    runCommandsWorker()
  }
}

function stopWorkers() {
  for (let i = 0; i < workers.length; i++) {
    workers[i].kill()
  }
  workers = []
  if (localWorkerRunning) {
    stopCommandsWorker()
    localWorkerRunning = false
  }
}

//--------------------------- Test --------------------------
export interface ItestRunCommandReq {
  workerPath: string
  numberOfWorkers: number
  localRun?: boolean
}

export function testRunCommmand(req: ItestRunCommandReq) {
  before(() => {
    runWorkers(req)
  })

  test('command executes only once', async () => {
    const async = container.resolve(Async)
    const tagRepository = container.resolve(TagRepository)
    const jobRepository = container.resolve(JobRepository)

    const tagValue = Random.alphaNumeric(128)

    let job = await async.runCommand(SaveTag, { value: tagValue })

    await waitUntil(() => jobRepository.findOrThrow(job.id).then((job) => job.hasFinished()), 10000)

    await wait(2000)

    const savedTags = await tagRepository.findByValue(tagValue)
    assert.equal(savedTags.length, 1)
  })

  after(() => {
    stopWorkers()
  })
}
