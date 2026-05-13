import test, { after, before } from 'node:test'
import { cronHandler } from './@cronHandler'
import { runCronHandlers, stopCronHandlers } from './runCronHandlers'
import {
  isValidCronSequence,
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
import { Job } from './Job'

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
@cronHandler({ name: 'cron-each-2s', cron: '*/2 * * * * *' })
class CronHandler2s {
  constructor(private testTagRepository: TestTagRepository) {}

  async handle() {
    const tag = new TestTag({ value: 'cron-each-2s' })
    await this.testTagRepository.create(tag)
  }
}

@cronHandler({ name: 'cron-each-5s', cron: '*/5 * * * * *' })
class CronHandler5s {
  constructor(private testTagRepository: TestTagRepository) {}

  async handle() {
    const tag = new TestTag({ value: 'cron-each-5s' })
    await this.testTagRepository.create(tag)
  }
}

//-----------------------  Handlers ---------------------------
const cronHandlers = [CronHandler2s, CronHandler5s]
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

  test('1 command executes only once', async () => {
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

  test('10 commands executes 10 times', async () => {
    const async = container.resolve(Async)
    const tagRepository = container.resolve(TestTagRepository)
    const jobRepository = container.resolve(JobRepository)

    const tagValue = Random.alphaNumeric(128)
    const N = 10

    const jobs: Job[] = []
    for (let i = 0; i < N; i++) {
      const job = await async.runCommand(SaveTestTag, { value: tagValue })
      jobs.push(job)
    }

    await waitUntil(async () => {
      const results = await Promise.all(
        jobs.map((job) => jobRepository.findOrThrow(job.id).then((job_1) => job_1.hasFinished())),
      )
      return results.every((x) => x)
    }, 5000)

    await wait(2000)

    const savedTags = await tagRepository.findByValue(tagValue)
    assert.equal(savedTags.length, N)
  })

  test('cron works with seconds intervals', async () => {
    const tagRepository = container.resolve(TestTagRepository)
    const start = new Date()

    await wait(17000)

    const tagsEach2s = await tagRepository.findByValue('cron-each-2s', { order: 'desc', limit: 8 })
    const tagsEach5s = await tagRepository.findByValue('cron-each-5s', { order: 'desc', limit: 3 })

    assert(tagsEach2s.length >= 7, 'cron each-2s not run almost 7 times')
    assert(tagsEach5s.length >= 2, 'cron each-5s not run almost 2 times')

    assert(tagsEach2s[0].createdAt > start, 'last cron each-2s execution is not recent')
    assert(tagsEach5s[0].createdAt > start, 'last cron each-5s execution is not recent')

    assert(
      isValidCronSequence('*/2 * * * * *', tagsEach2s.map((x) => x.createdAt).reverse(), {
        toleranceMs: 1500,
      }),
      'cron each-2s execution secuence is incorrect',
    )
    assert(
      isValidCronSequence('*/5 * * * * *', tagsEach5s.map((x) => x.createdAt).reverse(), {
        toleranceMs: 1500,
      }),
      'cron each-5s execution secuence is incorrect',
    )
  })

  after(() => {
    stopAsyncWorkers()
    if (req.localRun) stopAsyncHandler()
  })
}
