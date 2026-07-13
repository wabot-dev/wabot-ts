import { container } from '@/core/injection'
import { testAudioSpeechSynthesizer } from '@/feature/chat-bot/testAudioAdapters'
import { describe } from 'node:test'
import { OpenaiAudioSpeechSynthesizer } from './OpenaiAudioSpeechSynthesizer'

describe('OpenaiAudioSpeechSynthesizer', () => {
  const synthesizer = container.resolve(OpenaiAudioSpeechSynthesizer)

  testAudioSpeechSynthesizer({
    synthesizer,
    model: 'tts-1',
    voice: 'alloy',
  })
})
