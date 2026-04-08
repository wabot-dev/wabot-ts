import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { OpenaiAudioSpeechSynthesizer } from './OpenaiAudioSpeechSynthesizer'

process.env.OPENAI_API_KEY ??= 'test-key'

describe('OpenaiAudioSpeechSynthesizer', () => {
  describe('synthesize', () => {
    test('synthesizes mp3 audio', async () => {
      const synthesizer = new OpenaiAudioSpeechSynthesizer()
      ;(synthesizer as any).openai = {
        audio: {
          speech: {
            create: async () => ({
              arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer,
            }),
          },
        },
      }

      const result = await synthesizer.synthesize({
        model: 'tts-1',
        voice: 'alloy',
        text: 'Hello, world!',
        format: 'mp3',
      })

      assert.deepEqual([...result.audio], [1, 2, 3])
      assert.equal(result.format, 'mp3')
      assert.equal(result.mimeType, 'audio/mpeg')
    })

    test('synthesizes wav audio', async () => {
      const synthesizer = new OpenaiAudioSpeechSynthesizer()
      ;(synthesizer as any).openai = {
        audio: {
          speech: {
            create: async () => ({
              arrayBuffer: async () => Uint8Array.from([4, 5, 6]).buffer,
            }),
          },
        },
      }

      const result = await synthesizer.synthesize({
        model: 'tts-1',
        voice: 'alloy',
        text: 'Testing WAV format',
        format: 'wav',
      })

      assert.deepEqual([...result.audio], [4, 5, 6])
      assert.equal(result.format, 'wav')
      assert.equal(result.mimeType, 'audio/wav')
    })

    test('synthesizes opus audio', async () => {
      const synthesizer = new OpenaiAudioSpeechSynthesizer()
      ;(synthesizer as any).openai = {
        audio: {
          speech: {
            create: async () => ({
              arrayBuffer: async () => Uint8Array.from([7, 8, 9]).buffer,
            }),
          },
        },
      }

      const result = await synthesizer.synthesize({
        model: 'tts-1',
        voice: 'alloy',
        text: 'Testing Opus format',
        format: 'opus',
      })

      assert.deepEqual([...result.audio], [7, 8, 9])
      assert.equal(result.format, 'opus')
      assert.equal(result.mimeType, 'audio/opus')
    })
  })
})
