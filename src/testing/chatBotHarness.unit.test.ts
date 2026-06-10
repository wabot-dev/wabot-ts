import assert from 'node:assert/strict'
import test from 'node:test'

import { Auth } from '@/core/auth'
import { description } from '@/core/description'
import { isNotEmpty, isString } from '@/core/validation'
import { IMindset, IMindsetIdentity, mindset, mindsetModule } from '@/feature/mindset'

import { createChatBotHarness } from './chatBotHarness'
import { MockChatAdapter } from './MockChatAdapter'

class GreetArgs {
  @isString()
  @isNotEmpty()
  @description('name of the person to greet')
  name: string = ''
}

class GreetRegistry {
  greeted: string[] = []
}

@mindsetModule()
class GreeterModule {
  constructor(
    private registry: GreetRegistry,
    private auth: Auth<{ userId: string }>,
  ) {}

  @description('Greet a person by name')
  async greet(args: GreetArgs) {
    this.registry.greeted.push(args.name)
    const by = this.auth.isAssigned() ? this.auth.require().userId : 'anonymous'
    return `greeted ${args.name} by ${by}`
  }
}

@mindset({ modules: [GreeterModule] })
class GreeterMindset implements IMindset {
  async identity(): Promise<IMindsetIdentity> {
    return { name: 'Greta', language: 'english' }
  }
  async context() {
    return 'a test bot'
  }
  async skills() {
    return 'greeting people warmly'
  }
  async limits() {
    return 'never be rude'
  }
  async workflow() {
    return 'greet on request'
  }
  async models() {
    return { llm: [{ model: 'mock-model' }] }
  }
}

test('delivers scripted replies with the mindset identity', async () => {
  const harness = createChatBotHarness({ mindset: GreeterMindset })
  harness.adapter.reply('¡Hola!')

  const turn = await harness.send('hola')

  assert.equal(turn.replies.length, 1)
  assert.equal(turn.replies[0].text, '¡Hola!')
  assert.equal(turn.replies[0].senderName, 'Greta')
  assert.equal(turn.toolCalls.length, 0)
  assert.equal(harness.history().length, 2)
})

test('runs the real tool loop: validation, module execution and result', async () => {
  const registry = new GreetRegistry()
  const harness = createChatBotHarness({
    mindset: GreeterMindset,
    register: [[GreetRegistry, registry]],
  })
  harness.adapter.callTool('greet', { name: 'Ana' }).reply('Saludada')

  const turn = await harness.send('saluda a Ana')

  assert.deepEqual(registry.greeted, ['Ana'])
  assert.equal(turn.toolCalls.length, 1)
  assert.equal(turn.toolCalls[0].name, 'greet')
  assert.match(turn.toolCalls[0].result ?? '', /greeted Ana/)
  assert.deepEqual(
    turn.replies.map((r) => r.text),
    ['Saludada'],
  )
})

test('invalid tool arguments produce the INVALID_ARGUMENTS result', async () => {
  const harness = createChatBotHarness({ mindset: GreeterMindset })

  const result = await harness.callTool('greet', {})

  assert.match(result, /INVALID_ARGUMENTS/)
})

test('callTool executes a single tool with the assigned authInfo', async () => {
  const registry = new GreetRegistry()
  const harness = createChatBotHarness({
    mindset: GreeterMindset,
    register: [[GreetRegistry, registry]],
    authInfo: { userId: 'u1' },
  })

  const result = await harness.callTool('greet', { name: 'Luis' })

  assert.equal(result, 'greeted Luis by u1')
  assert.deepEqual(registry.greeted, ['Luis'])
})

test('exposes the real system prompt and tool definitions', async () => {
  const harness = createChatBotHarness({ mindset: GreeterMindset })

  const prompt = await harness.systemPrompt()
  const tools = harness.tools()

  assert.match(prompt, /greeting people warmly/)
  assert.match(prompt, /Greta/)
  assert.equal(tools.length, 1)
  assert.equal(tools[0].name, 'greet')
  assert.equal(tools[0].parameters[0].name, 'name')
})

test('the adapter records the requests the bot sends', async () => {
  const harness = createChatBotHarness({ mindset: GreeterMindset })
  harness.adapter.reply('ok')

  await harness.send('hola')

  const req = harness.adapter.lastRequest
  assert.ok(req)
  assert.equal(req.models[0].model, 'mock-model')
  assert.equal(req.tools.length, 1)
  assert.equal(req.prevItems[req.prevItems.length - 1].humanMessage?.text, 'hola')
})

test('send fails loudly when the mock has no scripted response', async () => {
  const harness = createChatBotHarness({ mindset: GreeterMindset })

  await assert.rejects(() => harness.send('hola'), /no scripted response/)
})

test('a custom adapter instance can be injected', async () => {
  const adapter = new MockChatAdapter({ fallbackReply: 'fallback' })
  const harness = createChatBotHarness({ mindset: GreeterMindset, adapter })

  const turn = await harness.send('hola')

  assert.equal(turn.replies[0].text, 'fallback')
  assert.equal(harness.adapter, adapter)
})
