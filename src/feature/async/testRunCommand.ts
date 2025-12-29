import { IStorableData } from '@/core/storable'
import { command } from './@command'
import { Command } from './Command'
import { commandHandler } from './@commandHandler'
import { runAsyncCommandHandlers } from './runCommandHandlers'
import test, { after } from 'node:test'
import { container } from '@/core/injection'
import { JobRepository } from './JobRepository'
import { Async } from './Async'
import { spawn } from 'node:child_process'
import { Entity, IEntityData } from '@/core/entity'
import { Random } from '@/core/random'
import assert from 'node:assert'

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

//-----------------------  Commands ---------------------------
interface ISaveTagCommandData extends IStorableData {
  value: string
}

@command('save-tag')
class SaveTag extends Command<ISaveTagCommandData> {}

@commandHandler({ command: SaveTag })
class SaveTagHandler {
  constructor(private tagRepository: TagRepository) {}

  async handle(command: SaveTag) {
    const { value } = command.getData()
    const tag = new Tag({ value })
    await this.tagRepository.create(tag)
  }
}

//-----------------------  Workers ---------------------------
export function runCommandsWorker() {
  runAsyncCommandHandlers([SaveTagHandler])
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

function runWorkers(workerPath: string, n = 3) {
  const env = {
    DATABASE_URL: process.env.DATABASE_URL,
    DEBUG: process.env.DEBUG,
    WABOT_JOB_MANAGER_LOOP_INTERVAL_SECONDS: '1',
    WABOT_JOB_MANAGER_RECOVERY_INTERVAL_SECONDS: '1',
    WABOT_JOB_MANAGER_MAX_CONCURRENT_JOBS: '2',
  }

  const nodeArgs = [...process.execArgv, workerPath]

  const workers = [
    spawn(process.execPath, nodeArgs, { env, stdio: 'inherit' }),
    spawn(process.execPath, nodeArgs, { env, stdio: 'inherit' }),
    spawn(process.execPath, nodeArgs, { env, stdio: 'inherit' }),
  ]
  return workers
}

//--------------------------- Test --------------------------
export interface ItestRunCommandReq {
  workerPath: string
}

export function testRunCommmand({ workerPath }: ItestRunCommandReq) {
  const async = container.resolve(Async)
  const tagRepository = container.resolve(TagRepository)
  const jobRepository = container.resolve(JobRepository)
  const workers = runWorkers(workerPath, 3)

  test('command executes only once', async () => {
    const tagValue = Random.alphaNumeric(128)

    let job = await async.runCommand(new SaveTag({ value: tagValue }))

    await waitUntil(() => jobRepository.findOrThrow(job.id).then((job) => job.hasFinished()), 10000)

    await wait(2000)

    const savedTags = await tagRepository.findByValue(tagValue)
    assert.equal(savedTags.length, 1)
  })

  after(() => {
    workers.forEach((w) => w.kill())
  })
}
