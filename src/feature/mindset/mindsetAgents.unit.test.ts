import assert from 'node:assert/strict'
import test from 'node:test'

import { description } from '@/core/description'
import { agent, IAgent } from '@/feature/agent'
import { tools } from '@/feature/tool'
import { IMindsetIdentity, IMindsetModels } from '@/feature/mindset'
import { mindset } from './metadata'
import { IMindset } from './IMindset'
import { createChatBotHarness } from '@/testing/chatBotHarness'
import { MockChatAdapter } from '@/testing/MockChatAdapter'

// --- tools: one exposable, one privileged (agent-only) ---------------------
@tools()
class SafeTools {
  @description('Read some safe data.')
  async readSafe() {
    return 'safe-data'
  }
}

@tools({ exposeToMindsets: false })
class PrivilegedTools {
  @description('Do a privileged thing.')
  async doPrivileged() {
    return 'privileged-done'
  }
}

@tools()
class LoopTools {
  @description('Never resolves anything.')
  async noop() {
    return 'again'
  }
}

// --- agents -----------------------------------------------------------------
@agent({ tools: [SafeTools, PrivilegedTools], description: 'Answers helper questions.' })
class HelperAgent implements IAgent {
  async instructions() {
    return 'You are a helper agent.'
  }
  async models(): Promise<IMindsetModels> {
    return { llm: [{ provider: 'mock', model: 'm' }] }
  }
}

@agent() // no description
class NoDescAgent implements IAgent {
  async instructions() {
    return 'x'
  }
  async models(): Promise<IMindsetModels> {
    return { llm: [{ provider: 'mock', model: 'm' }] }
  }
}

@agent({ tools: [LoopTools], description: 'Loops forever.' })
class LoopAgent implements IAgent {
  async instructions() {
    return 'Keep calling noop.'
  }
  async models(): Promise<IMindsetModels> {
    return { llm: [{ provider: 'mock', model: 'm' }] }
  }
}

// --- mindsets ---------------------------------------------------------------
abstract class TestMindset implements IMindset {
  async identity(): Promise<IMindsetIdentity> {
    return { name: 'T', language: 'english' }
  }
  async context() {
    return 'ctx'
  }
  async skills() {
    return 'skills'
  }
  async limits() {
    return 'limits'
  }
  async workflow() {
    return 'flow'
  }
  async models(): Promise<IMindsetModels> {
    return { llm: [{ provider: 'mock', model: 'm' }] }
  }
}

@mindset({ agents: [HelperAgent] })
class DefaultMindset extends TestMindset {}

@mindset({ agents: [{ agent: HelperAgent, allow: [PrivilegedTools] }] })
class AllowMindset extends TestMindset {}

@mindset({ agents: [{ agent: HelperAgent, name: 'consult_helper', description: 'custom desc' }] })
class NamedMindset extends TestMindset {}

@mindset({ agents: [NoDescAgent] })
class BadMindset extends TestMindset {}

@tools()
class CollidingTools {
  @description('collides with the default agent tool name')
  async ask_helper() {
    return 'x'
  }
}

@mindset({ modules: [CollidingTools], agents: [HelperAgent] })
class CollisionMindset extends TestMindset {}

@mindset({ agents: [{ agent: LoopAgent, budget: { maxSteps: 1 } }] })
class BudgetMindset extends TestMindset {}

test.describe('mindset → agents as tools', () => {
  test('exposes each declared agent as a single free-text tool', () => {
    const h = createChatBotHarness({ mindset: DefaultMindset })
    const tool = h.tools().find((t) => t.name === 'ask_helper')
    assert.ok(tool, 'agent exposed as ask_helper')
    assert.match(tool!.description, /helper questions/i)
    assert.equal(tool!.parameters.length, 1)
    assert.equal(tool!.parameters[0].name, 'input')
    assert.equal(tool!.parameters[0].schema.type, 'string')
  })

  test('calling the agent tool runs the agent and returns its reply text', async () => {
    const adapter = new MockChatAdapter()
    adapter.reply('Suggested: Tuesday 3pm')
    const h = createChatBotHarness({ mindset: DefaultMindset, adapter })

    const res = await h.callTool('ask_helper', { input: 'when is a good slot?' })
    assert.match(res, /Tuesday 3pm/)

    // The agent got its own instructions + only the task text (isolated).
    const req = adapter.lastRequest!
    assert.match(req.systemPrompt, /You are a helper agent/)
    assert.ok(
      req.prevItems.some(
        (i) => i.type === 'humanMessage' && (i.humanMessage.text ?? '').includes('good slot'),
      ),
      'task text reached the agent',
    )
  })

  test('rejects an agent call with a missing/empty input', async () => {
    const h = createChatBotHarness({ mindset: DefaultMindset })
    const res = await h.callTool('ask_helper', {})
    assert.match(res, /INVALID_ARGUMENTS/)
  })

  test('by default, gating hides the agent’s exposeToMindsets:false tools', async () => {
    const adapter = new MockChatAdapter({ fallbackReply: 'ok' })
    const h = createChatBotHarness({ mindset: DefaultMindset, adapter })
    await h.callTool('ask_helper', { input: 'x' })

    const names = adapter.lastRequest!.tools.map((t) => t.name)
    assert.ok(names.includes('readSafe'), 'safe tool exposed to the agent')
    assert.ok(!names.includes('doPrivileged'), 'privileged tool hidden by forMindset')
  })

  test('allow-list restricts the agent to exactly the given tools', async () => {
    const adapter = new MockChatAdapter({ fallbackReply: 'ok' })
    const h = createChatBotHarness({ mindset: AllowMindset, adapter })
    await h.callTool('ask_helper', { input: 'x' })

    const names = adapter.lastRequest!.tools.map((t) => t.name)
    assert.ok(names.includes('doPrivileged'), 'allow-listed privileged tool now reachable')
    assert.ok(!names.includes('readSafe'), 'allow-list excludes everything else')
  })

  test('a binding can override the tool name and description', () => {
    const h = createChatBotHarness({ mindset: NamedMindset })
    const names = h.tools().map((t) => t.name)
    assert.ok(!names.includes('ask_helper'))
    const tool = h.tools().find((t) => t.name === 'consult_helper')
    assert.ok(tool)
    assert.equal(tool!.description, 'custom desc')
  })

  test('an agent exposed without a description fails fast', () => {
    assert.throws(() => createChatBotHarness({ mindset: BadMindset }), /no description/i)
  })

  test('an agent tool name that collides with a module tool fails fast', () => {
    assert.throws(() => createChatBotHarness({ mindset: CollisionMindset }), /collides/i)
  })

  test('the default budget caps a runaway agent and notes it stopped', async () => {
    const adapter = new MockChatAdapter()
    adapter.callTool('noop') // agent keeps calling a tool, never answers
    const h = createChatBotHarness({ mindset: BudgetMindset, adapter })

    const res = await h.callTool('ask_loop', { input: 'go' })
    assert.match(res, /could not finish|stopped/i)
  })
})
