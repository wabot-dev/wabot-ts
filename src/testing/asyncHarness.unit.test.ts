import assert from 'node:assert/strict'
import test from 'node:test'

import { isNotEmpty, isString } from '@/core/validation'
import {
  command,
  commandHandler,
  cronHandler,
  ICommandHandler,
  ICronHandler,
} from '@/feature/async'

import { createAsyncHarness } from './asyncHarness'

@command('record-value')
class RecordValueCommand {
  @isString()
  @isNotEmpty()
  value: string = ''
}

class ValueStore {
  values: string[] = []
}

@commandHandler(RecordValueCommand)
class RecordValueHandler implements ICommandHandler<RecordValueCommand> {
  constructor(private store: ValueStore) {}

  async handle(command: RecordValueCommand) {
    this.store.values.push(command.value)
  }
}

const cronRuns: string[] = []

@cronHandler({ name: 'test-cron', cron: '*/5 * * * *' })
class TestCronHandler implements ICronHandler {
  async handle() {
    cronRuns.push('ran')
  }
}

class NotACron implements ICronHandler {
  async handle() {}
}

class NotACommand {
  value: string = ''
}

test('executes a command handler inline with real validation', async () => {
  const store = new ValueStore()
  const harness = createAsyncHarness({ register: [[ValueStore, store]] })

  const command = await harness.execute(RecordValueCommand, { value: 'hola' })

  assert.deepEqual(store.values, ['hola'])
  assert.ok(command instanceof RecordValueCommand)
  assert.equal(command.value, 'hola')
})

test('rejects invalid command data with readable issues', async () => {
  const harness = createAsyncHarness({ register: [[ValueStore, new ValueStore()]] })

  await assert.rejects(() => harness.execute(RecordValueCommand, { value: '' }), /value/)
})

test('fails clearly for classes without the @command decorator', async () => {
  const harness = createAsyncHarness()

  await assert.rejects(
    () => harness.execute(NotACommand, { value: 'x' }),
    /not registered with the @command decorator/,
  )
})

test('runs a cron handler once', async () => {
  const harness = createAsyncHarness()

  await harness.runCron(TestCronHandler)

  assert.deepEqual(cronRuns, ['ran'])
})

test('fails clearly for classes without the @cronHandler decorator', async () => {
  const harness = createAsyncHarness()

  await assert.rejects(() => harness.runCron(NotACron), /not registered/)
})
