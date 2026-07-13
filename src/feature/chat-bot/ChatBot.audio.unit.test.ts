import test from 'node:test'
import assert from 'node:assert/strict'
import { container } from '@/core/injection'
import {
  type IMindset,
  type IMindsetDescription,
  type IMindsetModels,
  mindset,
} from '@/feature/mindset'
import { createChatBotHarness, MockChatAdapter } from '@/testing'
import { AudioSpeechSynthesizer } from './AudioSpeechSynthesizer'
import { AudioTranscriber } from './AudioTranscriber'
import { IChatAdapterNextItemsReq } from './IChatAdapter'

@mindset({})
class AudioMindset implements IMindset {
  async describe(): Promise<IMindsetDescription> {
    return {
      identity: { name: 'Eco', language: 'español' },
      context: '',
      skills: '',
      limits: '',
      workflow: '',
    }
  }
  async models(): Promise<IMindsetModels> {
    return {
      llm: [{ provider: 'mock', model: 'm' }],
      speechToText: [{ provider: 'openai', model: 'whisper-1' }],
      textToSpeech: [{ provider: 'openai', model: 'tts-1' }],
    }
  }
}

const voiceNote = () => ({
  audios: [
    {
      id: 'a1',
      mimeType: 'audio/ogg',
      base64Url: `data:audio/ogg;base64,${Buffer.from('ogg-bytes').toString('base64')}`,
    },
  ],
})

test.describe('ChatBot audio (mindset-driven)', () => {
  test('transcribes inbound voice (speechToText) and mirrors with voice (textToSpeech)', async () => {
    const stt: any[] = []
    const tts: any[] = []
    container.register(AudioTranscriber, {
      useValue: {
        transcribe: async (r: any) => {
          stt.push(r)
          return { text: 'hola, quiero una cita' }
        },
      },
    })
    container.register(AudioSpeechSynthesizer, {
      useValue: {
        synthesize: async (r: any) => {
          tts.push(r)
          return { audio: Buffer.from('spoken'), format: 'mp3', mimeType: 'audio/mpeg' }
        },
      },
    })

    let seenReq: IChatAdapterNextItemsReq | undefined
    const adapter = new MockChatAdapter()
    adapter.enqueue((req: IChatAdapterNextItemsReq) => {
      seenReq = req
      return [{ type: 'botMessage', botMessage: { text: 'Claro, con gusto.' } }]
    })
    const harness = createChatBotHarness({ mindset: AudioMindset, adapter })

    const turn = await harness.send(voiceNote())

    // STT ran with the mindset's model, and the transcript reached the LLM.
    assert.equal(stt[0].model, 'whisper-1')
    assert.equal(stt[0].provider, 'openai')
    const lastHuman = seenReq!.prevItems.at(-1)!
    assert.equal(
      lastHuman.type === 'humanMessage' && lastHuman.humanMessage.text,
      'hola, quiero una cita',
    )

    // TTS synthesized the reply with the mindset's model, delivered on the reply.
    assert.equal(tts[0].model, 'tts-1')
    assert.equal(tts[0].text, 'Claro, con gusto.')
    assert.match(turn.replies[0].audios?.[0]?.base64Url ?? '', /^data:audio\/mpeg;base64,/)
  })

  test('text messages are untouched (no STT/TTS)', async () => {
    const stt: any[] = []
    container.register(AudioTranscriber, {
      useValue: {
        transcribe: async (r: any) => {
          stt.push(r)
          return { text: 'x' }
        },
      },
    })
    const harness = createChatBotHarness({
      mindset: AudioMindset,
      adapter: new MockChatAdapter().reply('hola'),
    })

    const turn = await harness.send('buenas')

    assert.equal(stt.length, 0) // no inbound audio → no transcription
    assert.equal(turn.replies[0].text, 'hola')
    assert.equal(turn.replies[0].audios, undefined) // voice out only mirrors voice in
  })
})
