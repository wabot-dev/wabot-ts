import test from 'node:test'
import assert from 'node:assert/strict'
import { OpenaiTtsConfig } from './OpenaiTtsConfig'

test.describe('OpenaiTtsConfig', () => {
  test('Default values', () => {
    const config = new OpenaiTtsConfig()
    assert.equal(config.model, 'tts-1', 'Default model should be tts-1')
    assert.equal(config.voice, 'alloy', 'Default voice should be alloy')
    assert.equal(config.format, 'mp3', 'Default format should be mp3')
  })

  test('Custom values', () => {
    const config = new OpenaiTtsConfig('tts-1-hd', 'echo', 'wav')
    assert.equal(config.model, 'tts-1-hd', 'Model should be tts-1-hd')
    assert.equal(config.voice, 'echo', 'Voice should be echo')
    assert.equal(config.format, 'wav', 'Format should be wav')
  })

  test('Partial custom values with defaults', () => {
    const config = new OpenaiTtsConfig('tts-1-hd')
    assert.equal(config.model, 'tts-1-hd', 'Model should be tts-1-hd')
    assert.equal(config.voice, 'alloy', 'Default voice should be alloy')
    assert.equal(config.format, 'mp3', 'Default format should be mp3')
  })
})
