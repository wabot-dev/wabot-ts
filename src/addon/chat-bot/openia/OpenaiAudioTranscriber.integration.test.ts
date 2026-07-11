import { container } from '@/core/injection'
import { testAudioTranscriber } from '@/feature/chat-bot/testAudioAdapters'
import { describe } from 'node:test'
import { OpenaiAudioTranscriber } from './OpenaiAudioTranscriber'
import { OpenaiAudioSpeechSynthesizer } from './OpenaiAudioSpeechSynthesizer'

describe('OpenaiAudioTranscriber', () => {
  const transcriber = container.resolve(OpenaiAudioTranscriber)
  const synthesizer = container.resolve(OpenaiAudioSpeechSynthesizer)

  const phrase = 'The quick brown fox jumps over the lazy dog'
  let cached: { audio: Buffer; mimeType: string } | undefined

  // Round-trip: synthesize a known phrase once, then transcribe it back.
  const sample = async () => {
    if (!cached) {
      const res = await synthesizer.synthesize({
        model: 'tts-1',
        voice: 'alloy',
        text: phrase,
        format: 'mp3',
      })
      cached = { audio: res.audio, mimeType: res.mimeType }
    }
    return { ...cached, expect: ['fox', 'quick', 'brown'] }
  }

  testAudioTranscriber({
    transcriber,
    model: 'whisper-1',
    sample,
  })
})
