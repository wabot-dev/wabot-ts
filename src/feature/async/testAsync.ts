import test, { after, before } from 'node:test'
import { cron } from './@cron'
import { runCronHandlers, stopCronHandlers } from './runCronHandlers'
import {
  runAsyncWorkers,
  stopAsyncWorkers,
  TestTag,
  TestTagRepository,
  wait,
  waitUntil,
} from './testAsyncHelpers'
import { command } from './@command'
import { isString } from '@/core/validation'
import { commandHandler } from './@commandHandler'
import { runCommandHandlers, stopCommandHandlers } from './runCommandHandlers'
import { container } from '@/core/injection'
import { Async } from './Async'
import { JobRepository } from './JobRepository'
import { Random } from '@/core/random'
import assert from 'node:assert'

//---------------------- Commands --------------------
@command('save-test-tag')
class SaveTestTag {
  @isString()
  value!: string
}

@commandHandler(SaveTestTag)
class SaveTestTagHandler {
  constructor(private tagRepository: TestTagRepository) {}

  async handle({ value }: SaveTestTag) {
    const tag = new TestTag({ value })
    await this.tagRepository.create(tag)
  }
}

//-----------------------  Crons ----------------------

@cron({ name: 'cron-each-2-s', cron: '*/2 * * * * *' })
@cron({ name: 'cron-each-5-s', cron: '*/5 * * * * *' })
class CronHandler {
  constructor(private testTagRepository: TestTagRepository) {}

  async handle() {
    const tag = new TestTag({ value: Random.alphaNumeric(128) })
    await this.testTagRepository.create(tag)
  }

  async handleError(e: any) {}
}

//-----------------------  Handlers ---------------------------
const cronHandlers = [CronHandler]
const commandHandlers = [SaveTestTagHandler]

export function runAsyncHandlers() {
  runCronHandlers(cronHandlers)
  runCommandHandlers(commandHandlers)
}

export function stopAsyncHandler() {
  stopCronHandlers(cronHandlers)
  stopCommandHandlers(commandHandlers)
}

//--------------------------- Test --------------------------
export interface ItestCronReq {
  workerPath: string
  numberOfWorkers: number
  localRun?: boolean
}

export function testAsync(req: ItestCronReq) {
  before(() => {
    runAsyncWorkers(req)
    if (req.localRun) runAsyncHandlers()
  })

  test('command executes only once', async () => {
    const async = container.resolve(Async)
    const tagRepository = container.resolve(TestTagRepository)
    const jobRepository = container.resolve(JobRepository)

    const tagValue = Random.alphaNumeric(128)

    let job = await async.runCommand(SaveTestTag, { value: tagValue })

    await waitUntil(() => jobRepository.findOrThrow(job.id).then((job) => job.hasFinished()), 5000)

    await wait(2000)

    const savedTags = await tagRepository.findByValue(tagValue)
    assert.equal(savedTags.length, 1)
  })

  test('cron executes only once', async () => {
    await wait(5000)
  })

  after(() => {
    stopAsyncWorkers()
    if (req.localRun) stopAsyncHandler()
  })
}
