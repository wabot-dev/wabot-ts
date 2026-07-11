import test from 'node:test'
import assert from 'node:assert/strict'
import { VoiceBotRegistry } from './VoiceBotRegistry'
import { Mindset } from '@/feature/mindset'

class BotA extends Mindset {}
class BotB extends Mindset {}

test.describe('VoiceBotRegistry', () => {
  test('the first registered bot becomes the default', () => {
    const registry = new VoiceBotRegistry()
    registry.register({ name: 'A', mindset: BotA })
    registry.register({ name: 'B', mindset: BotB })

    assert.equal(registry.defaultBotName(), 'A')
    assert.equal(registry.get()?.mindset, BotA)
  })

  test('get(name) returns the named bot; unknown returns undefined', () => {
    const registry = new VoiceBotRegistry()
    registry.register({ name: 'A', mindset: BotA })
    registry.register({ name: 'B', mindset: BotB, greeting: 'hola' })

    assert.equal(registry.get('B')?.greeting, 'hola')
    assert.equal(registry.get('missing'), undefined)
  })

  test('default: true overrides the default bot', () => {
    const registry = new VoiceBotRegistry()
    registry.register({ name: 'A', mindset: BotA })
    registry.register({ name: 'B', mindset: BotB }, { default: true })
    assert.equal(registry.defaultBotName(), 'B')
  })
})
