import test from 'node:test'
import assert from 'node:assert/strict'
import { MindsetOperator } from '@/feature/mindset'
import { VoiceBot } from './VoiceBot'
import { IVoiceCall } from './IIncomingVoiceCall'
import { IVoiceMediaStream, VoiceAudioFormat } from './IVoiceMediaStream'
import {
  IRealtimeVoiceEngine,
  IRealtimeVoiceEngineSession,
  IRealtimeVoiceSessionConfig,
} from './IRealtimeVoiceEngine'
import { RealtimeVoiceEngine } from './RealtimeVoiceEngine'

class FakeMedia implements IVoiceMediaStream {
  format: VoiceAudioFormat = 'g711_ulaw'
  onAudio() {}
  onDtmf() {}
  onClose() {}
  play() {}
  clear() {}
  hangup() {}
}

class FakeSession implements IRealtimeVoiceEngineSession {
  responses: (string | undefined)[] = []
  appendAudio() {}
  submitToolResult() {}
  createResponse(instructions?: string) {
    this.responses.push(instructions)
  }
  cancelResponse() {}
  sendUserText() {}
  close() {}
  onAudio() {}
  onSpeechStarted() {}
  onResponseDone() {}
  onFunctionCall() {}
  onClose() {}
  onError() {}
}

class FakeEngine implements IRealtimeVoiceEngine {
  session = new FakeSession()
  lastConfig?: IRealtimeVoiceSessionConfig
  async open(config: IRealtimeVoiceSessionConfig): Promise<IRealtimeVoiceEngineSession> {
    this.lastConfig = config
    return this.session
  }
}

const mindset = {
  async systemPrompt() {
    return 'PROMPT'
  },
  tools() {
    return []
  },
  async callFunction() {
    return ''
  },
} as unknown as MindsetOperator

const makeBot = (engine: FakeEngine) =>
  new VoiceBot(mindset, engine as unknown as RealtimeVoiceEngine)

const makeCall = (over: Partial<IVoiceCall> = {}): IVoiceCall => ({
  connection: { callId: 'CA1', from: '+1', to: '+2', direction: 'inbound', channelName: 'twilio' },
  media: new FakeMedia(),
  ...over,
})

test.describe('VoiceBot.answer', () => {
  test('defaults the voice to the one on the call (channel-decorator / intent value)', async () => {
    const engine = new FakeEngine()
    await makeBot(engine).answer(makeCall({ voice: 'marin' }))
    // No answer({ voice }) → the number stays consistent on its configured voice.
    assert.equal(engine.lastConfig?.voice, 'marin')
  })

  test('an explicit answer({ voice }) overrides the call default', async () => {
    const engine = new FakeEngine()
    await makeBot(engine).answer(makeCall({ voice: 'marin' }), { voice: 'verse' })
    assert.equal(engine.lastConfig?.voice, 'verse')
  })

  test('greeting also falls back to the call greeting', async () => {
    const engine = new FakeEngine()
    await makeBot(engine).answer(makeCall({ greeting: 'Saluda', voice: 'marin' }))
    assert.deepEqual(engine.session.responses, ['Saluda'])
  })
})
