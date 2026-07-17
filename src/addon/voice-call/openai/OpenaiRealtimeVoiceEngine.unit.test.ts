import test from 'node:test'
import assert from 'node:assert/strict'
import { IToolSchema } from '@/feature/tool'
import { IRealtimeVoiceSessionConfig } from '@/feature/voice-call'
import { IRealtimeSocket } from './IRealtimeSocket'
import {
  OpenaiRealtimeVoiceEngine,
  OpenaiRealtimeVoiceEngineSession,
} from './OpenaiRealtimeVoiceEngine'

class FakeSocket implements IRealtimeSocket {
  sent: string[] = []
  closed = false
  private openLs: (() => void)[] = []
  private msgLs: ((d: string) => void)[] = []
  private closeLs: (() => void)[] = []
  private errLs: ((e: unknown) => void)[] = []

  send(data: string) {
    this.sent.push(data)
  }
  close() {
    this.closed = true
  }
  onOpen(l: () => void) {
    this.openLs.push(l)
  }
  onMessage(l: (d: string) => void) {
    this.msgLs.push(l)
  }
  onClose(l: () => void) {
    this.closeLs.push(l)
  }
  onError(l: (e: unknown) => void) {
    this.errLs.push(l)
  }

  emitOpen() {
    this.openLs.forEach((l) => l())
  }
  emitMessage(obj: unknown) {
    this.msgLs.forEach((l) => l(JSON.stringify(obj)))
  }
  emitClose() {
    this.closeLs.forEach((l) => l())
  }
  emitError(e: unknown) {
    this.errLs.forEach((l) => l(e))
  }
  parsed() {
    return this.sent.map((s) => JSON.parse(s))
  }
  last() {
    return JSON.parse(this.sent[this.sent.length - 1])
  }
}

const tool: IToolSchema = {
  language: 'spanish',
  name: 'get_time',
  description: 'hora de una ciudad',
  parameters: [{ name: 'city', required: true, schema: { type: 'string', description: 'ciudad' } }],
}

const config = (over: Partial<IRealtimeVoiceSessionConfig> = {}): IRealtimeVoiceSessionConfig => ({
  instructions: 'Eres un asistente colombiano',
  tools: [tool],
  audioFormat: 'g711_ulaw',
  voice: 'verse',
  ...over,
})

test.describe('OpenaiRealtimeVoiceEngineSession', () => {
  test('configure() sends the GA session.update with codec, voice, VAD and tools', () => {
    const socket = new FakeSocket()
    const session = new OpenaiRealtimeVoiceEngineSession(socket, config())
    session.configure()

    const msg = socket.last()
    assert.equal(msg.type, 'session.update')
    assert.equal(msg.session.type, 'realtime') // GA shape
    assert.deepEqual(msg.session.output_modalities, ['audio'])
    assert.equal(msg.session.audio.input.format.type, 'audio/pcmu') // g711_ulaw → pcmu
    assert.equal(msg.session.audio.output.format.type, 'audio/pcmu')
    assert.equal(msg.session.audio.output.voice, 'verse')
    assert.equal(msg.session.audio.input.turn_detection.type, 'server_vad')
    assert.equal(msg.session.tool_choice, 'auto')
    assert.equal(msg.session.tools.length, 1)
    assert.equal(msg.session.tools[0].name, 'get_time')
    assert.equal(msg.session.tools[0].parameters.required[0], 'city')
  })

  test('tool_choice is none when there are no tools', () => {
    const socket = new FakeSocket()
    new OpenaiRealtimeVoiceEngineSession(socket, config({ tools: [] })).configure()
    assert.equal(socket.last().session.tool_choice, 'none')
  })

  test('forwards model audio deltas (both event names) to onAudio', () => {
    const socket = new FakeSocket()
    const session = new OpenaiRealtimeVoiceEngineSession(socket, config())
    const got: string[] = []
    session.onAudio((a) => got.push(a))

    socket.emitMessage({ type: 'response.audio.delta', delta: 'AAA' })
    socket.emitMessage({ type: 'response.output_audio.delta', delta: 'BBB' })

    assert.deepEqual(got, ['AAA', 'BBB'])
  })

  test('fires onSpeechStarted for barge-in', () => {
    const socket = new FakeSocket()
    const session = new OpenaiRealtimeVoiceEngineSession(socket, config())
    let started = 0
    session.onSpeechStarted(() => started++)
    socket.emitMessage({ type: 'input_audio_buffer.speech_started' })
    assert.equal(started, 1)
  })

  test('emits function calls from the model', () => {
    const socket = new FakeSocket()
    const session = new OpenaiRealtimeVoiceEngineSession(socket, config())
    const calls: unknown[] = []
    session.onFunctionCall((c) => calls.push(c))

    socket.emitMessage({
      type: 'response.function_call_arguments.done',
      call_id: 'c1',
      name: 'get_time',
      arguments: '{"city":"Bogota"}',
    })

    assert.deepEqual(calls, [{ callId: 'c1', name: 'get_time', arguments: '{"city":"Bogota"}' }])
  })

  test('append/tool-result/response send the right events', () => {
    const socket = new FakeSocket()
    const session = new OpenaiRealtimeVoiceEngineSession(socket, config())

    session.appendAudio('zzz')
    session.submitToolResult('c1', 'ok')
    session.createResponse('di hola')
    session.createResponse()

    const msgs = socket.parsed()
    const append = msgs.find((m) => m.type === 'input_audio_buffer.append')
    assert.equal(append.audio, 'zzz')
    const out = msgs.find((m) => m.type === 'conversation.item.create')
    assert.equal(out.item.type, 'function_call_output')
    assert.equal(out.item.call_id, 'c1')
    assert.equal(out.item.output, 'ok')
    const responses = msgs.filter((m) => m.type === 'response.create')
    assert.equal(responses[0].response.instructions, 'di hola')
    assert.deepEqual(responses[1].response, {})
  })

  test('cancelResponse sends response.cancel (barge-in)', () => {
    const socket = new FakeSocket()
    const session = new OpenaiRealtimeVoiceEngineSession(socket, config())
    session.cancelResponse()
    assert.equal(socket.last().type, 'response.cancel')
  })

  test('sendUserText injects a user turn and requests a response', () => {
    const socket = new FakeSocket()
    const session = new OpenaiRealtimeVoiceEngineSession(socket, config())
    session.sendUserText('El usuario presionó 5')

    const msgs = socket.parsed()
    const item = msgs.find((m) => m.type === 'conversation.item.create')
    assert.equal(item.item.role, 'user')
    assert.equal(item.item.content[0].type, 'input_text')
    assert.equal(item.item.content[0].text, 'El usuario presionó 5')
    assert.equal(msgs.at(-1).type, 'response.create')
  })

  test('propagates socket close and error', () => {
    const socket = new FakeSocket()
    const session = new OpenaiRealtimeVoiceEngineSession(socket, config())
    let closed = 0
    let err: unknown
    session.onClose(() => closed++)
    session.onError((e) => (err = e))

    socket.emitError(new Error('boom'))
    socket.emitClose()

    assert.equal(closed, 1)
    assert.equal((err as Error).message, 'boom')
  })

  test('close() closes the socket', () => {
    const socket = new FakeSocket()
    new OpenaiRealtimeVoiceEngineSession(socket, config()).close()
    assert.equal(socket.closed, true)
  })
})

test.describe('OpenaiRealtimeVoiceEngine', () => {
  test('open() sends session.update on connect and resolves on session.updated', async () => {
    const socket = new FakeSocket()
    const engine = new OpenaiRealtimeVoiceEngine()
    ;(engine as unknown as { createSocket: () => IRealtimeSocket }).createSocket = () => socket

    const opening = engine.open(config())
    let resolved = false
    void opening.then(() => (resolved = true))

    socket.emitOpen()
    await new Promise((r) => setImmediate(r))
    // Config was sent, but we must not report ready until OpenAI acks it —
    // otherwise the greeting response renders with the default voice.
    assert.equal(socket.parsed()[0].type, 'session.update')
    assert.equal(resolved, false)

    socket.emitMessage({ type: 'session.updated' })
    const session = await opening
    assert.ok(session)
    assert.equal(resolved, true)
  })

  test('response.done fires onResponseDone (ends the greeting window)', () => {
    const socket = new FakeSocket()
    const session = new OpenaiRealtimeVoiceEngineSession(socket, config())
    let done = 0
    session.onResponseDone(() => done++)
    socket.emitMessage({ type: 'response.done' })
    assert.equal(done, 1)
  })
})
