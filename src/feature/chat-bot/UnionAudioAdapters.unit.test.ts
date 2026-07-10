import test from 'node:test'
import assert from 'node:assert/strict'
import { AudioAdapterRegistry } from './AudioAdapterRegistry'
import { IAudioTranscribeReq, IAudioTranscribeRes, IAudioTranscriber } from './IAudioTranscriber'
import {
  IAudioSpeechSynthesizer,
  IAudioSynthesizeReq,
  IAudioSynthesizeRes,
} from './IAudioSpeechSynthesizer'
import { UnionAudioTranscriber } from './UnionAudioTranscriber'
import { UnionAudioSpeechSynthesizer } from './UnionAudioSpeechSynthesizer'

class FakeTranscriber implements IAudioTranscriber {
  public calls: IAudioTranscribeReq[] = []
  constructor(private label: string) {}
  async transcribe(req: IAudioTranscribeReq): Promise<IAudioTranscribeRes> {
    this.calls.push(req)
    return { text: `${this.label}:${req.model}` }
  }
}

class FakeSynthesizer implements IAudioSpeechSynthesizer {
  public calls: IAudioSynthesizeReq[] = []
  constructor(private label: string) {}
  async synthesize(req: IAudioSynthesizeReq): Promise<IAudioSynthesizeRes> {
    this.calls.push(req)
    return { audio: Buffer.from(this.label), format: req.format ?? 'mp3', mimeType: 'audio/mpeg' }
  }
}

const transcribeReq = (over: Partial<IAudioTranscribeReq> = {}): IAudioTranscribeReq => ({
  model: 'whisper-1',
  audio: Buffer.from('x'),
  ...over,
})

const synthReq = (over: Partial<IAudioSynthesizeReq> = {}): IAudioSynthesizeReq => ({
  model: 'tts-1',
  voice: 'alloy',
  text: 'hi',
  ...over,
})

test.describe('UnionAudioTranscriber', () => {
  test('throws when no transcriber is registered', async () => {
    const union = new UnionAudioTranscriber(new AudioAdapterRegistry())
    await assert.rejects(union.transcribe(transcribeReq()), /No audio transcriber registered/)
  })

  test('routes to the requested provider', async () => {
    const registry = new AudioAdapterRegistry()
    const openai = new FakeTranscriber('openai')
    const other = new FakeTranscriber('other')
    registry.registerTranscriber('openai', openai)
    registry.registerTranscriber('other', other)

    const union = new UnionAudioTranscriber(registry)
    const res = await union.transcribe(transcribeReq({ provider: 'other' }))

    assert.equal(res.text, 'other:whisper-1')
    assert.equal(openai.calls.length, 0)
    assert.equal(other.calls.length, 1)
  })

  test('uses the first registered provider as default', async () => {
    const registry = new AudioAdapterRegistry()
    const first = new FakeTranscriber('first')
    const second = new FakeTranscriber('second')
    registry.registerTranscriber('openai', first)
    registry.registerTranscriber('other', second)

    const union = new UnionAudioTranscriber(registry)
    const res = await union.transcribe(transcribeReq())

    assert.equal(res.text, 'first:whisper-1')
    assert.equal(first.calls.length, 1)
    assert.equal(second.calls.length, 0)
  })

  test('throws for an unregistered provider', async () => {
    const registry = new AudioAdapterRegistry()
    registry.registerTranscriber('openai', new FakeTranscriber('openai'))
    const union = new UnionAudioTranscriber(registry)
    await assert.rejects(
      union.transcribe(transcribeReq({ provider: 'nope' })),
      /No audio transcriber registered for provider 'nope'/,
    )
  })
})

test.describe('UnionAudioSpeechSynthesizer', () => {
  test('throws when no synthesizer is registered', async () => {
    const union = new UnionAudioSpeechSynthesizer(new AudioAdapterRegistry())
    await assert.rejects(union.synthesize(synthReq()), /No audio speech synthesizer registered/)
  })

  test('routes to the requested provider, falling back to default', async () => {
    const registry = new AudioAdapterRegistry()
    const openai = new FakeSynthesizer('openai')
    registry.registerSynthesizer('openai', openai)

    const union = new UnionAudioSpeechSynthesizer(registry)
    const res = await union.synthesize(synthReq())

    assert.equal(res.mimeType, 'audio/mpeg')
    assert.equal(openai.calls.length, 1)
  })
})
