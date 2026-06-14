import test from 'node:test'
import assert from 'node:assert/strict'
import { shouldRespondToMention, shouldRespondToTrigger } from './shouldRespondToMention'
import type { IDiscordMessageContext } from './IDiscordMessageContext'

const baseCtx: IDiscordMessageContext = {
  botUserId: 'bot-1',
  wasBotMentioned: false,
  wasEveryoneMentioned: false,
  isDirectMessage: false,
}

test.describe('shouldRespondToMention', () => {
  test('returns true in DMs', () => {
    assert.equal(shouldRespondToMention({ ...baseCtx, isDirectMessage: true }), true)
  })

  test('returns true when bot is @-mentioned in a guild', () => {
    assert.equal(shouldRespondToMention({ ...baseCtx, wasBotMentioned: true }), true)
  })

  test('returns true on @everyone/@here in a guild', () => {
    assert.equal(shouldRespondToMention({ ...baseCtx, wasEveryoneMentioned: true }), true)
  })

  test('returns false for plain text in a guild without mention', () => {
    assert.equal(shouldRespondToMention(baseCtx), false)
  })
})

test.describe('shouldRespondToTrigger', () => {
  test('returns true in DMs regardless of text', () => {
    assert.equal(
      shouldRespondToTrigger({ ...baseCtx, isDirectMessage: true }, 'elia', 'cualquier cosa'),
      true,
    )
  })

  test('matches a whole word in a guild', () => {
    assert.equal(shouldRespondToTrigger(baseCtx, 'elia', 'elia, ¿estás ahí?'), true)
  })

  test('is case-insensitive', () => {
    assert.equal(shouldRespondToTrigger(baseCtx, 'elia', 'ELIA hola'), true)
  })

  test('strips diacritics', () => {
    assert.equal(shouldRespondToTrigger(baseCtx, 'elia', 'Elía, ¿estás ahí?'), true)
  })

  test('does not match substrings (eliana is not elia)', () => {
    assert.equal(shouldRespondToTrigger(baseCtx, 'elia', 'no la eliana, sino el otro'), false)
  })

  test('returns false when trigger is missing from text', () => {
    assert.equal(shouldRespondToTrigger(baseCtx, 'elia', 'no, gracias'), false)
  })

  test('returns false when trigger is empty', () => {
    assert.equal(shouldRespondToTrigger(baseCtx, '', 'elia hola'), false)
  })

  test('returns false when text is empty', () => {
    assert.equal(shouldRespondToTrigger(baseCtx, 'elia', ''), false)
  })

  test('escapes regex metacharacters in trigger', () => {
    assert.equal(shouldRespondToTrigger(baseCtx, 'a.b', 'hola a.b amigo'), true)
    assert.equal(shouldRespondToTrigger(baseCtx, 'a.b', 'hola axb amigo'), false)
  })
})
