import assert from 'node:assert/strict'
import test from 'node:test'

import { description } from '@/core/description'
import { tools } from '@/feature/tool'
import { IMindsetModels } from '@/feature/mindset'
import { agent, Agent, ANSWER_TOOL_NAME } from '@/feature/agent'

import { createAgentHarness } from './agentHarness'
import { MockChatAdapter } from './MockChatAdapter'

@tools()
class KbTools {
  @description('Search the knowledge base.')
  async kbSearch() {
    return 'kb-result'
  }
}

@tools({ exposeToMindsets: false })
class AdminTools {
  @description('A privileged admin operation.')
  async adminOp() {
    return 'admin-done'
  }
}

@agent({ tools: [KbTools, AdminTools], description: 'Triage specialist.' })
class TriageAgent extends Agent {
  async instructions() {
    return 'You are a triage specialist.'
  }
  async models(): Promise<IMindsetModels> {
    return { llm: [{ model: 'mock-model' }] }
  }
}

class Probe {
  hits: string[] = []
}

@tools()
class ProbeTools {
  constructor(private probe: Probe) {}
  @description('Ping the probe.')
  async ping() {
    this.probe.hits.push('ping')
    return 'pong'
  }
}

@agent({ tools: [ProbeTools], description: 'Probe agent.' })
class ProbeAgent extends Agent {
  async instructions() {
    return 'Call ping when asked.'
  }
  async models(): Promise<IMindsetModels> {
    return { llm: [{ model: 'mock-model' }] }
  }
}

test('session() runs the real agent against the scripted adapter', async () => {
  const adapter = new MockChatAdapter().reply('resolved')
  const harness = createAgentHarness({ agent: TriageAgent, adapter })

  const reply = await harness.session().order('what should I do?')
  assert.equal(reply.type, 'answer')
  assert.match(reply.text, /resolved/)
  assert.match(adapter.lastRequest!.systemPrompt, /triage specialist/i)
})

test('for() returns the production builder — forMindset() hides privileged tools', async () => {
  const adapter = new MockChatAdapter({ fallbackReply: 'ok' })
  const harness = createAgentHarness({ agent: TriageAgent, adapter })

  await harness.for().forMindset().session().order('x')
  const names = adapter.lastRequest!.tools.map((t) => t.name)
  assert.ok(names.includes('kbSearch'))
  assert.ok(!names.includes('adminOp'), 'exposeToMindsets:false hidden')
})

test('for().allowTools() restricts the session to the whitelist', async () => {
  const adapter = new MockChatAdapter({ fallbackReply: 'ok' })
  const harness = createAgentHarness({ agent: TriageAgent, adapter })

  await harness.for().allowTools([AdminTools]).session().order('x')
  const names = adapter.lastRequest!.tools.map((t) => t.name)
  assert.deepEqual(names, ['adminOp'])
})

test('withBudget() caps the loop and yields a stopped reply', async () => {
  const adapter = new MockChatAdapter().callTool('ping') // never answers
  const harness = createAgentHarness({
    agent: ProbeAgent,
    adapter,
    register: [[Probe, new Probe()]],
  })

  const reply = await harness.for().withBudget({ maxSteps: 1 }).session().order('go')
  assert.equal(reply.type, 'stopped')
})

test('register wires the agent tools’ dependencies', async () => {
  const probe = new Probe()
  const adapter = new MockChatAdapter().callTool('ping').reply('done')
  const harness = createAgentHarness({ agent: ProbeAgent, adapter, register: [[Probe, probe]] })

  await harness.session().order('please ping')
  assert.deepEqual(probe.hits, ['ping'])
})

test('defaults to a MockChatAdapter exposed on the harness', () => {
  const harness = createAgentHarness({ agent: TriageAgent })
  assert.ok(harness.adapter instanceof MockChatAdapter)
})

test('confirm/ask flow through the answer tool', async () => {
  const adapter = new MockChatAdapter().callTool(ANSWER_TOOL_NAME, { value: true })
  const harness = createAgentHarness({ agent: TriageAgent, adapter })
  const yes = await harness.session().confirm('proceed?')
  assert.equal(yes, true)
})
