import assert from 'node:assert/strict'
import test from 'node:test'

import { description } from '@/core/description'
import { isBoolean, isNumber } from '@/core/validation'
import { IChatItem } from '@/feature/chat-bot'
import { IMindsetModels } from '@/feature/mindset'
import { tools } from '@/feature/tool'
import { MockChatAdapter } from '@/testing/MockChatAdapter'
import { createAgentHarness } from '@/testing/agentHarness'

import { agent } from './@agent'
import { Agent } from './IAgent'
import { IAgentBudget } from './AgentSession'
import { AgentReply, ANSWER_TOOL_NAME, AgentPausedError } from './AgentReply'

const toolCalls: string[] = []

class AddReq {
  @isNumber()
  @description('first addend')
  a: number = 0

  @isNumber()
  @description('second addend')
  b: number = 0
}

@tools()
class MathTools {
  @description('Add two numbers and return the sum')
  add(req: AddReq) {
    toolCalls.push(`add:${req.a}+${req.b}`)
    return req.a + req.b
  }
}

class TriageResult {
  @isBoolean()
  @description('true when the case is urgent')
  urgent: boolean = false
}

@agent({ tools: [MathTools] })
class MathAgent extends Agent {
  async instructions(): Promise<string> {
    return 'You are a precise math and triage agent.'
  }
  async models(): Promise<IMindsetModels> {
    return { llm: [{ model: 'mock-model' }] }
  }
}

function makeSession(mock: MockChatAdapter, options: { budget?: IAgentBudget; context?: string } = {}) {
  let builder = createAgentHarness({ agent: MathAgent, adapter: mock }).for()
  if (options.budget) builder = builder.withBudget(options.budget)
  return builder.session(options.context)
}

test('ask() returns a validated, typed answer via the answer tool', async () => {
  const mock = new MockChatAdapter().callTool(ANSWER_TOOL_NAME, { urgent: true })
  const session = makeSession(mock)
  const result = await session.ask('is this urgent?', TriageResult)
  assert.equal(result.urgent, true)
})

test('confirm() coerces a boolean answer', async () => {
  const mock = new MockChatAdapter().callTool(ANSWER_TOOL_NAME, { value: true })
  const session = makeSession(mock)
  assert.equal(await session.confirm('should the bot respond?'), true)
})

test('the agent can call real tools before answering', async () => {
  toolCalls.length = 0
  const mock = new MockChatAdapter()
    .callTool('add', { a: 2, b: 3 })
    .callTool(ANSWER_TOOL_NAME, { urgent: false })
  const session = makeSession(mock)
  const result = await session.ask('add 2 and 3, is it urgent?', TriageResult)
  assert.equal(result.urgent, false)
  assert.deepEqual(toolCalls, ['add:2+3'])
})

test('order() surfaces a question when the model replies with prose despite a schema', async () => {
  const mock = new MockChatAdapter().reply('Which case are you referring to?')
  const session = makeSession(mock)
  const reply = (await session.order('triage it', TriageResult)) as AgentReply<TriageResult>
  assert.equal(reply.type, 'question')
  assert.equal(reply.text, 'Which case are you referring to?')
})

test('order() without a schema returns the text as the answer', async () => {
  const mock = new MockChatAdapter().reply('all done')
  const session = makeSession(mock)
  const reply = await session.order('do the thing')
  assert.equal(reply.type, 'answer')
  if (reply.type === 'answer') assert.equal(reply.value, 'all done')
})

test('ask() throws AgentPausedError when the agent asks back', async () => {
  const mock = new MockChatAdapter().reply('I need the account id')
  const session = makeSession(mock)
  await assert.rejects(() => session.ask('is it urgent?', TriageResult), AgentPausedError)
})

test('budget maxSteps stops the loop instead of throwing', async () => {
  const mock = new MockChatAdapter().callTool('add', { a: 1, b: 1 })
  const session = makeSession(mock, { budget: { maxSteps: 1 } })
  const reply = await session.order('loop forever', TriageResult)
  assert.equal(reply.type, 'stopped')
  if (reply.type === 'stopped') assert.equal(reply.reason, 'maxSteps')
})

test('attachChat/attachMessage inject the conversation as read-only material', async () => {
  const mock = new MockChatAdapter().callTool(ANSWER_TOOL_NAME, { value: false })
  const session = makeSession(mock)
  const history: IChatItem[] = [
    { type: 'humanMessage', humanMessage: { text: 'hola' } },
    { type: 'botMessage', botMessage: { text: 'hello, how can I help?', senderName: 'Elia' } },
  ]
  session.attachChat(history).attachMessage({ text: 'ok thanks bye' })

  const shouldRespond = await session.confirm('should the bot respond to the last message?')
  assert.equal(shouldRespond, false)

  const prompt = mock.lastRequest!.systemPrompt
  assert.match(prompt, /Reference material/)
  assert.match(prompt, /hello, how can I help\?/)
  assert.match(prompt, /Current message:/)
  assert.match(prompt, /ok thanks bye/)
})

test('the session accumulates its transcript across turns', async () => {
  const mock = new MockChatAdapter()
    .callTool(ANSWER_TOOL_NAME, { value: true })
    .callTool(ANSWER_TOOL_NAME, { value: false })
  const session = makeSession(mock)
  assert.equal(await session.confirm('first?'), true)
  assert.equal(await session.confirm('second?'), false)
  // Second turn's request must contain the first turn in prevItems.
  const secondRequest = mock.requests[mock.requests.length - 1]
  assert.ok(
    secondRequest.prevItems.some(
      (i) => i.type === 'humanMessage' && i.humanMessage.text === 'first?',
    ),
    'first turn is present in the second turn transcript',
  )
})
