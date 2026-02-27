import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { OpenaiAudioSpeechSynthesizer } from './OpenaiAudioSpeechSynthesizer'
import { container } from '@/core/injection'

describe('OpenaiAudioSpeechSynthesizer', () => {
  const synthesizer = container.resolve(OpenaiAudioSpeechSynthesizer)

  describe('synthesize', () => {
    test('should synthesize text to audio', async () => {
      const result = await synthesizer.synthesize({
        model: 'tts-1',
        voice: 'alloy',
        text: 'Hello, world!',
        format: 'mp3',
      })

      assert.ok(result.audio, 'Should return audio buffer')
      assert.ok(result.audio.length > 0, 'Audio buffer should not be empty')
      assert.equal(result.format, 'mp3', 'Format should be mp3')
      assert.equal(result.mimeType, 'audio/mpeg', 'MIME type should be audio/mpeg')
    })

    test('should support different formats', async () => {
      const result = await synthesizer.synthesize({
        model: 'tts-1',
        voice: 'alloy',
        text: 'Testing WAV format',
        format: 'wav',
      })

      assert.equal(result.format, 'wav', 'Format should be wav')
      assert.equal(result.mimeType, 'audio/wav', 'MIME type should be audio/wav')
    })
  })
})
