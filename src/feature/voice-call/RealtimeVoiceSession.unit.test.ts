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
  drainCalls = 0
  /** When true, waitForDrain stays pending until resolveDrain() is called. */
  manualDrain = false
  private drainResolvers: (() => void)[] = []
  private audioListeners: ((a: string) => void)[] = []
  private dtmfListeners: ((d: string) => void)[] = []
  private closeListeners: (() => void)[] = []

  onAudio(l: (a: string) => void) {
    this.audioListeners.push(l)
  }
  onDtmf(l: (d: string) => void) {
    this.dtmfListeners.push(l)
  }
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
  waitForDrain() {
    this.drainCalls++
    if (!this.manualDrain) return Promise.resolve()
    return new Promise<void>((resolve) => this.drainResolvers.push(resolve))
  }

  resolveDrain() {
    this.drainResolvers.forEach((r) => r())
    this.drainResolvers = []
  }
  emitAudio(a: string) {
    this.audioListeners.forEach((l) => l(a))
  }
  emitDtmf(d: string) {
    this.dtmfListeners.forEach((l) => l(d))
  }
  emitClose() {
    this.closeListeners.forEach((l) => l())
  }
}

class FakeEngineSession implements IRealtimeVoiceEngineSession {
  appended: string[] = []
  toolResults: { callId: string; output: string }[] = []
  responses: (string | undefined)[] = []
  userTexts: string[] = []
  cancels = 0
  closes = 0
  private audioL?: (a: string) => void
  private speechL?: () => void
  private responseDoneL?: () => void
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
  cancelResponse() {
    this.cancels++
  }
  sendUserText(text: string) {
    this.userTexts.push(text)
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
  onResponseDone(l: () => void) {
    this.responseDoneL = l
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
  emitResponseDone() {
    this.responseDoneL?.()
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
    const toolNames = engine.openConfig?.tools.map((t) => t.name)
    assert.deepEqual(toolNames, ['get_time', 'end_call']) // end_call auto-added
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

  test('barge-in flushes playback and cancels the model response', async () => {
    const media = new FakeMediaStream()
    const engine = new FakeEngine()
    await RealtimeVoiceSession.start({ media, engine, connection, instructions: 'x' })

    engine.session.emitSpeechStarted()
    assert.equal(media.clears, 1)
    assert.equal(engine.session.cancels, 1)
  })

  test('forwards caller DTMF to the model as a user turn', async () => {
    const media = new FakeMediaStream()
    const engine = new FakeEngine()
    await RealtimeVoiceSession.start({ media, engine, connection, instructions: 'x' })

    media.emitDtmf('5')
    assert.equal(engine.session.userTexts.length, 1)
    assert.match(engine.session.userTexts[0], /5/)
  })

  test('the built-in end_call tool hangs up', async () => {
    const media = new FakeMediaStream()
    const engine = new FakeEngine()
    await RealtimeVoiceSession.start({ media, engine, connection, instructions: 'x' })

    engine.session.emitFunctionCall({ callId: 'c1', name: 'end_call', arguments: '{}' })
    await flush()
    assert.equal(media.hangups, 1)
    assert.equal(engine.session.closes, 1)
    assert.equal(engine.session.toolResults[0]?.callId, 'c1')
  })

  test('end_call waits for playback to drain before hanging up', async () => {
    const media = new FakeMediaStream()
    media.manualDrain = true // hold the drain open so we can observe the ordering
    const engine = new FakeEngine()
    await RealtimeVoiceSession.start({ media, engine, connection, instructions: 'x' })

    engine.session.emitFunctionCall({ callId: 'c1', name: 'end_call', arguments: '{}' })
    await flush()

    // Goodbye acknowledged and drain requested, but the line is still open.
    assert.equal(engine.session.toolResults[0]?.callId, 'c1')
    assert.equal(media.drainCalls, 1)
    assert.equal(media.hangups, 0)
    assert.equal(engine.session.closes, 0)

    media.resolveDrain() // Twilio finished playing the goodbye
    await flush()
    assert.equal(media.hangups, 1)
    assert.equal(engine.session.closes, 1)
  })

  test('greeting holds the caller mic and suppresses barge-in until it finishes', async () => {
    const media = new FakeMediaStream()
    const engine = new FakeEngine()
    await RealtimeVoiceSession.start({
      media,
      engine,
      connection,
      instructions: 'x',
      greeting: 'Saluda al cliente',
    })

    // While the greeting plays, caller audio is held and echo/noise can't clip it.
    media.emitAudio('caller-frame')
    engine.session.emitSpeechStarted()
    assert.deepEqual(engine.session.appended, [])
    assert.equal(engine.session.cancels, 0)
    assert.equal(media.clears, 0)

    // Greeting finishes generating and playing → full duplex resumes.
    engine.session.emitResponseDone()
    await flush()
    media.emitAudio('caller-frame-2')
    engine.session.emitSpeechStarted()
    assert.deepEqual(engine.session.appended, ['caller-frame-2'])
    assert.equal(engine.session.cancels, 1)
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
