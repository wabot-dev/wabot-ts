import assert from 'node:assert/strict'
import test from 'node:test'

import { description } from '@/core/description'
import { tools } from '@/feature/tool'
import { IMindsetIdentity, IMindsetModels } from '@/feature/mindset'
import { mindset } from './metadata'
import { IMindset } from './IMindset'
import { createChatBotHarness } from '@/testing/chatBotHarness'

@tools()
class GreetTools {
  @description('Greet someone.')
  async greet() {
    return 'hi'
  }
}

@tools()
class FarewellTools {
  @description('Say goodbye.')
  async farewell() {
    return 'bye'
  }
}

@tools()
class OtherGreetTools {
  @description('Greet someone (conflicting name).')
  async greet() {
    return 'hello'
  }
}

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

@mindset({ tools: [GreetTools] })
class ToolsKeyMindset extends TestMindset {}

@mindset({ modules: [GreetTools] }) // deprecated alias
class ModulesKeyMindset extends TestMindset {}

@mindset({ tools: [GreetTools], modules: [FarewellTools] })
class MergedMindset extends TestMindset {}

@mindset({ tools: [GreetTools, OtherGreetTools] })
class DuplicateMindset extends TestMindset {}

test.describe('mindset tools config', () => {
  test('the `tools` key exposes the tool functions', () => {
    const names = createChatBotHarness({ mindset: ToolsKeyMindset })
      .tools()
      .map((t) => t.name)
    assert.deepEqual(names, ['greet'])
  })

  test('the deprecated `modules` key still works', () => {
    const names = createChatBotHarness({ mindset: ModulesKeyMindset })
      .tools()
      .map((t) => t.name)
    assert.deepEqual(names, ['greet'])
  })

  test('`tools` and `modules` are merged when both are set', () => {
    const names = createChatBotHarness({ mindset: MergedMindset })
      .tools()
      .map((t) => t.name)
      .sort()
    assert.deepEqual(names, ['farewell', 'greet'])
  })

  test('a duplicate tool name across the mindset tools fails fast', () => {
    const harness = createChatBotHarness({ mindset: DuplicateMindset })
    assert.throws(() => harness.tools(), /Duplicate tool name.*'greet'/s)
  })
})
