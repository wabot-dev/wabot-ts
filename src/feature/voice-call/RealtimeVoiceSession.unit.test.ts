import test from 'node:test'
import assert from 'node:assert/strict'
import { RealtimeVoiceSession } from './RealtimeVoiceSession'
import { IVoiceMediaStream, VoiceAudioFormat } from './IVoiceMediaStream'
import { IVoiceCallConnection } from './IVoiceCallConnection'
import {
  IRealtimeFunctionCall,
  IRealtimeVoiceEngine,
  IRealtimeVoiceEngineSession,
  IRealtimeVoiceSessionConfig,
} from './IRealtimeVoiceEngine'

const flush = () => new Promise((resolve) => setImmediate(resolve))

class FakeMediaStream implements IVoiceMediaStream {
  format: VoiceAudioFormat = 'g711_ulaw'
  played: string[] = []
  clears = 0
  hangups = 0
  private audioListeners: ((a: string) => void)[] = []
  private closeListeners: (() => void)[] = []

  onAudio(l: (a: string) => void) {
    this.audioListeners.push(l)
  }
  onDtmf() {}
  onClose(l: () => void) {
    this.closeListeners.push(l)
  }
  play(a: string) {
    this.played.push(a)
  }
  clear() {
    this.clears++
  }
  hangup() {
    this.hangups++
  }

  emitAudio(a: string) {
    this.audioListeners.forEach((l) => l(a))
  }
  emitClose() {
    this.closeListeners.forEach((l) => l())
  }
}

class FakeEngineSession implements IRealtimeVoiceEngineSession {
  appended: string[] = []
  toolResults: { callId: string; output: string }[] = []
  responses: (string | undefined)[] = []
  closes = 0
  private audioL?: (a: string) => void
  private speechL?: () => void
  private fnL?: (c: IRealtimeFunctionCall) => void
  private closeL?: () => void

  appendAudio(a: string) {
    this.appended.push(a)
  }
  submitToolResult(callId: string, output: string) {
    this.toolResults.push({ callId, output })
  }
  createResponse(instructions?: string) {
    this.responses.push(instructions)
  }
  close() {
    this.closes++
  }
  onAudio(l: (a: string) => void) {
    this.audioL = l
  }
  onSpeechStarted(l: () => void) {
    this.speechL = l
  }
  onFunctionCall(l: (c: IRealtimeFunctionCall) => void) {
    this.fnL = l
  }
  onClose(l: () => void) {
    this.closeL = l
  }
  onError() {}

  emitAudio(a: string) {
    this.audioL?.(a)
  }
  emitSpeechStarted() {
    this.speechL?.()
  }
  emitFunctionCall(c: IRealtimeFunctionCall) {
    this.fnL?.(c)
  }
  emitClose() {
    this.closeL?.()
  }
}

class FakeEngine implements IRealtimeVoiceEngine {
  session = new FakeEngineSession()
  openConfig?: IRealtimeVoiceSessionConfig
  async open(config: IRealtimeVoiceSessionConfig) {
    this.openConfig = config
    return this.session
  }
}

const connection: IVoiceCallConnection = {
  callId: 'CA1',
  from: '+573001112233',
  to: '+576011234567',
  direction: 'inbound',
  channelName: 'TwilioVoiceChannel',
}

test.describe('RealtimeVoiceSession', () => {
  test('opens the engine with the media format, instructions and tools', async () => {
    const media = new FakeMediaStream()
    const engine = new FakeEngine()
    await RealtimeVoiceSession.start({
      media,
      engine,
      connection,
      instructions: 'Actúa como asistente',
      tools: [
        {
          language: 'spanish',
          name: 'get_time',
          description: 'hora actual',
          parameters: [],
        },
      ],
    })

    assert.equal(engine.openConfig?.audioFormat, 'g711_ulaw')
    assert.equal(engine.openConfig?.instructions, 'Actúa como asistente')
    assert.equal(engine.openConfig?.tools.length, 1)
  })

  test('bridges caller audio to the engine and engine audio to the caller', async () => {
    const media = new FakeMediaStream()
    const engine = new FakeEngine()
    await RealtimeVoiceSession.start({ media, engine, connection, instructions: 'x' })

    media.emitAudio('caller-frame')
    engine.session.emitAudio('bot-frame')

    assert.deepEqual(engine.session.appended, ['caller-frame'])
    assert.deepEqual(media.played, ['bot-frame'])
  })

  test('flushes queued playback on barge-in', async () => {
    const media = new FakeMediaStream()
    const engine = new FakeEngine()
    await RealtimeVoiceSession.start({ media, engine, connection, instructions: 'x' })

    engine.session.emitSpeechStarted()
    assert.equal(media.clears, 1)
  })

  test('routes a tool call and returns the result to the model', async () => {
    const media = new FakeMediaStream()
    const engine = new FakeEngine()
    const calls: { name: string; args: string }[] = []
    await RealtimeVoiceSession.start({
      media,
      engine,
      connection,
      instructions: 'x',
      callFunction: async (name, args) => {
        calls.push({ name, args })
        return 'RESULT'
      },
    })

    engine.session.emitFunctionCall({ callId: 'c1', name: 'book', arguments: '{"day":"mon"}' })
    await flush()

    assert.deepEqual(calls, [{ name: 'book', args: '{"day":"mon"}' }])
    assert.deepEqual(engine.session.toolResults, [{ callId: 'c1', output: 'RESULT' }])
    // a response is requested after the tool result so the model can speak
    assert.equal(engine.session.responses.length, 1)
  })

  test('returns an error result to the model when the tool throws', async () => {
    const media = new FakeMediaStream()
    const engine = new FakeEngine()
    await RealtimeVoiceSession.start({
      media,
      engine,
      connection,
      instructions: 'x',
      callFunction: async () => {
        throw new Error('kaboom')
      },
    })

    engine.session.emitFunctionCall({ callId: 'c9', name: 'bad', arguments: '{}' })
    await flush()

    assert.equal(engine.session.toolResults.length, 1)
    assert.match(engine.session.toolResults[0].output, /kaboom/)
  })

  test('greeting makes the bot speak first', async () => {
    const media = new FakeMediaStream()
    const engine = new FakeEngine()
    await RealtimeVoiceSession.start({
      media,
      engine,
      connection,
      instructions: 'x',
      greeting: 'Saluda al cliente',
    })

    assert.deepEqual(engine.session.responses, ['Saluda al cliente'])
  })

  test('caller hangup tears down both sides exactly once', async () => {
    const media = new FakeMediaStream()
    const engine = new FakeEngine()
    const session = await RealtimeVoiceSession.start({
      media,
      engine,
      connection,
      instructions: 'x',
    })

    media.emitClose()
    assert.equal(engine.session.closes, 1)
    assert.equal(media.hangups, 1)

    session.close() // idempotent
    assert.equal(engine.session.closes, 1)
    assert.equal(media.hangups, 1)
  })

  test('engine close hangs up the caller', async () => {
    const media = new FakeMediaStream()
    const engine = new FakeEngine()
    await RealtimeVoiceSession.start({ media, engine, connection, instructions: 'x' })

    engine.session.emitClose()
    assert.equal(media.hangups, 1)
    assert.equal(engine.session.closes, 1)
  })
})
