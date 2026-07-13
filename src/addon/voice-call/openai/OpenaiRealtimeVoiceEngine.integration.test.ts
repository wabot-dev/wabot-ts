import test from 'node:test'
import assert from 'node:assert/strict'
import { container } from '@/core/injection'
import { OpenaiRealtimeVoiceEngine } from './OpenaiRealtimeVoiceEngine'

// Live test: opens a real OpenAI Realtime WebSocket. Needs OPENAI_API_KEY with
// Realtime access (Twilio is NOT involved — the media bridge is tested manually
// with a real phone call). Skips when the key is absent.
const skip = process.env.OPENAI_API_KEY ? false : 'OPENAI_API_KEY not set'

test.describe('OpenaiRealtimeVoiceEngine (live)', { skip }, () => {
  test('connects, configures the session, and streams synthesized audio', async () => {
    const engine = container.resolve(OpenaiRealtimeVoiceEngine)

    const session = await engine.open({
      instructions: 'Eres un asistente breve. Responde en español, con una sola palabra.',
      tools: [],
      audioFormat: 'g711_ulaw',
      voice: 'alloy',
    })

    try {
      const firstAudioChunk = await new Promise<string>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('no audio received within 20s')), 20_000)
        session.onError((err) => {
          clearTimeout(timer)
          reject(err instanceof Error ? err : new Error(String(err)))
        })
        session.onAudio((chunk) => {
          clearTimeout(timer)
          resolve(chunk)
        })
        // Ask the model to speak; g711_ulaw audio deltas should come back.
        session.sendUserText('Saluda con una sola palabra.')
      })

      assert.equal(typeof firstAudioChunk, 'string')
      assert.ok(firstAudioChunk.length > 0, 'received a non-empty audio chunk')
    } finally {
      session.close()
    }
  })
})
