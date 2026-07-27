import test from 'node:test'
import assert from 'node:assert/strict'

import { container } from '@/core/injection'
import { CronJob, CronJobRepository, Job, JobRepository } from '@/feature/async'
import { Chat, ChatItem, ChatRepository } from '@/feature/chat-bot'
import { useMemoryRepositories } from '@/testing'
// Importing the addons registers the in-memory implementations of the custom
// queries, exactly as the runner does at boot.
import '@/addon/async/in-memory'
import '@/addon/chat-bot/in-memory'

useMemoryRepositories()

test.describe('CronJobRepository on the memory adapter', () => {
  const repo = container.resolve(CronJobRepository)

  test('findOneByName comes from the method-name grammar', async () => {
    const job = new CronJob({
      name: 'nightly',
      cron: '0 2 * * *',
      commandName: 'Cleanup',
      enabled: true,
    })
    await repo.create(job)

    assert.equal((await repo.findOneByName('nightly'))?.name, 'nightly')
    assert.equal(await repo.findOneByName('missing'), null)
  })

  test('findDue returns enabled jobs that are ready, soonest first', async () => {
    const now = Date.now()
    const soon = new CronJob({ name: 'soon', cron: '* * * * *', commandName: 'A', enabled: true })
    const later = new CronJob({ name: 'later', cron: '* * * * *', commandName: 'B', enabled: true })
    const off = new CronJob({ name: 'off', cron: '* * * * *', commandName: 'C', enabled: false })
    await repo.create(soon)
    await repo.create(later)
    await repo.create(off)
    soon['data'].nextRunAt = now - 2000
    later['data'].nextRunAt = now - 1000
    off['data'].nextRunAt = now - 3000
    await repo.update(soon)
    await repo.update(later)
    await repo.update(off)

    const due = await repo.findDue(new Date(now))

    assert.deepEqual(
      due.map((job) => job.name),
      ['soon', 'later'],
      'ordered by next run, and the disabled one stays out',
    )
  })
})

test.describe('JobRepository on the memory adapter', () => {
  const repo = container.resolve(JobRepository)

  async function seed(data: Partial<Record<string, unknown>>): Promise<Job> {
    const job = new Job({ commandName: 'SendEmail', payload: {}, ...data } as any)
    await repo.create(job)
    Object.assign(job['data'], data)
    await repo.update(job)
    return job
  }

  test('a pending job is found, a started one is not', async () => {
    const now = Date.now()
    await seed({ scheduledAt: now - 1000 })
    await seed({ scheduledAt: now - 1000, startedAt: now })

    const pending = await repo.findPendingForRunFrom(new Date(now), 10)

    assert.equal(pending.length, 1)
    assert.equal(pending[0]['data'].startedAt, undefined)
  })

  test('running jobs are the started ones that have not finished', async () => {
    const now = Date.now()
    await seed({ scheduledAt: now, startedAt: now })
    await seed({ scheduledAt: now, startedAt: now, successAt: now })

    const running = await repo.findRunningJobs()

    assert.ok(running.every((job) => job['data'].successAt == null))
    assert.equal(await repo.countRunningByCommand('SendEmail'), running.length)
  })

  test('findActiveByDedupKey ignores a job that succeeded before the window', async () => {
    const now = Date.now()
    await seed({ scheduledAt: now, dedupKey: 'k1', successAt: now - 10_000 })

    assert.equal(await repo.findActiveByDedupKey('SendEmail', 'k1', now - 5_000), null)

    const fresh = await seed({ scheduledAt: now, dedupKey: 'k1', successAt: now - 1_000 })
    const found = await repo.findActiveByDedupKey('SendEmail', 'k1', now - 5_000)

    assert.equal(found?.id, fresh.id)
  })
})

test.describe('ChatRepository on the memory adapter', () => {
  const repo = container.resolve(ChatRepository)

  test('findByConnection matches inside the connection list', async () => {
    const connection = { id: 'u-1', channelName: 'TelegramChannel', chatType: 'PRIVATE' as const }
    const chat = new Chat({ type: 'PRIVATE', connections: [connection] })
    await repo.create(chat)

    assert.equal((await repo.findByConnection(connection))?.id, chat.id)
    assert.equal(
      await repo.findByConnection({ id: 'nobody', channelName: 'X', chatType: 'PRIVATE' as const }),
      null,
    )
  })

  test('each chat memory only sees its own items, oldest first', async () => {
    const first = new Chat({
      type: 'PRIVATE',
      connections: [{ id: 'a', channelName: 'C', chatType: 'PRIVATE' as const }],
    })
    const second = new Chat({
      type: 'PRIVATE',
      connections: [{ id: 'b', channelName: 'C', chatType: 'PRIVATE' as const }],
    })
    await repo.create(first)
    await repo.create(second)

    const firstMemory = (await repo.findMemory(first.id))!
    const secondMemory = (await repo.findMemory(second.id))!
    await firstMemory.create(new ChatItem({ type: 'humanMessage', humanMessage: { text: 'one' } }))
    await firstMemory.create(new ChatItem({ type: 'humanMessage', humanMessage: { text: 'two' } }))
    await secondMemory.create(
      new ChatItem({ type: 'humanMessage', humanMessage: { text: 'other' } }),
    )

    const items = await firstMemory.findLastItems(10)

    assert.deepEqual(
      items.map((item) => item['data'].humanMessage?.text),
      ['one', 'two'],
    )
    assert.equal((await secondMemory.findLastItems(10)).length, 1)
  })

  test('findLastItems returns the newest window', async () => {
    const chat = new Chat({
      type: 'PRIVATE',
      connections: [{ id: 'c', channelName: 'C', chatType: 'PRIVATE' as const }],
    })
    await repo.create(chat)
    const memory = (await repo.findMemory(chat.id))!
    for (const text of ['1', '2', '3']) {
      await memory.create(new ChatItem({ type: 'humanMessage', humanMessage: { text } }))
    }

    const last = await memory.findLastItems(2)

    assert.deepEqual(
      last.map((item) => item['data'].humanMessage?.text),
      ['2', '3'],
    )
  })
})
