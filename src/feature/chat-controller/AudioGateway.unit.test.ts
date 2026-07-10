import test from 'node:test'
import assert from 'node:assert/strict'
import { AudioGateway } from './AudioGateway'
import {
  AudioConfig,
  IAudioSynthesizeReq,
  IAudioTranscribeReq,
  IChatMessageAudio,
} from '@/feature/chat-bot'

function makeGateway(
  config: AudioConfig,
  overrides: {
    transcribe?: (req: IAudioTranscribeReq) => Promise<{ text: string }>
    synthesize?: (
      req: IAudioSynthesizeReq,
    ) => Promise<{ audio: Buffer; format: any; mimeType: string }>
  } = {},
) {
  const transcriber = {
    transcribe: overrides.transcribe ?? (async () => ({ text: 'unused' })),
  }
  const synthesizer = {
    synthesize:
      overrides.synthesize ??
      (async () => ({ audio: Buffer.from('audio-bytes'), format: 'mp3', mimeType: 'audio/mpeg' })),
  }
  return new AudioGateway(transcriber as any, synthesizer as any, config)
}

const base64Audio = (mimeType: string, body: string): IChatMessageAudio => ({
  id: 'a1',
  mimeType,
  base64Url: `data:${mimeType};base64,${Buffer.from(body).toString('base64')}`,
})

test.describe('AudioGateway', () => {
  test('does not transcribe when no transcription model is configured', async () => {
    let called = false
    const gateway = makeGateway(new AudioConfig(null), {
      transcribe: async () => {
        called = true
        return { text: 'nope' }
      },
    })

    assert.equal(gateway.canTranscribe, false)
    assert.equal(await gateway.transcribe(base64Audio('audio/ogg', 'x')), undefined)
    assert.equal(called, false)
  })

  test('decodes base64 audio and returns trimmed transcript', async () => {
    let captured: IAudioTranscribeReq | undefined
    const gateway = makeGateway(new AudioConfig('whisper-1'), {
      transcribe: async (req) => {
        captured = req
        return { text: '  hello world  ' }
      },
    })

    const text = await gateway.transcribe(base64Audio('audio/ogg', 'voice-bytes'))

    assert.equal(text, 'hello world')
    assert.equal(captured?.model, 'whisper-1')
    assert.equal(captured?.mimeType, 'audio/ogg')
    assert.equal(captured?.audio.toString(), 'voice-bytes')
  })

  test('returns undefined when transcription fails', async () => {
    const gateway = makeGateway(new AudioConfig('whisper-1'), {
      transcribe: async () => {
        throw new Error('boom')
      },
    })
    assert.equal(await gateway.transcribe(base64Audio('audio/ogg', 'x')), undefined)
  })

  test('shouldReplyWithVoice honours the configured mode', async () => {
    const never = makeGateway(new AudioConfig('whisper-1', 'tts-1', 'alloy', 'mp3', 'never'))
    assert.equal(never.shouldReplyWithVoice(true), false)

    const always = makeGateway(new AudioConfig('whisper-1', 'tts-1', 'alloy', 'mp3', 'always'))
    assert.equal(always.shouldReplyWithVoice(false), true)

    const mirror = makeGateway(new AudioConfig('whisper-1', 'tts-1', 'alloy', 'mp3', 'mirror'))
    assert.equal(mirror.shouldReplyWithVoice(true), true)
    assert.equal(mirror.shouldReplyWithVoice(false), false)
  })

  test('never replies with voice when no synthesis model is configured', async () => {
    const gateway = makeGateway(new AudioConfig('whisper-1', null, 'alloy', 'mp3', 'always'))
    assert.equal(gateway.shouldReplyWithVoice(true), false)
    assert.equal(await gateway.synthesize('hi'), undefined)
  })

  test('synthesize returns a base64 audio attachment', async () => {
    let captured: IAudioSynthesizeReq | undefined
    const gateway = makeGateway(new AudioConfig('whisper-1', 'tts-1', 'echo', 'opus'), {
      synthesize: async (req) => {
        captured = req
        return { audio: Buffer.from('spoken'), format: req.format, mimeType: 'audio/ogg' }
      },
    })

    const audio = await gateway.synthesize('read this')

    assert.equal(captured?.model, 'tts-1')
    assert.equal(captured?.voice, 'echo')
    assert.equal(captured?.format, 'opus')
    assert.ok(audio)
    assert.equal(audio?.mimeType, 'audio/ogg')
    assert.equal(
      audio?.base64Url,
      `data:audio/ogg;base64,${Buffer.from('spoken').toString('base64')}`,
    )
    assert.ok(audio?.id)
  })
})
