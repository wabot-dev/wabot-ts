import test from 'node:test'
import assert from 'node:assert/strict'
import { Mindset } from '@/feature/mindset'
import { OutboundCallIntents, VoiceBotRegistry } from '@/feature/voice-call'
import { TwilioCallService } from './TwilioCallService'
import { TwilioVoiceConfig } from './TwilioVoiceConfig'

class DefaultBot extends Mindset {}

function setup() {
  const config = new TwilioVoiceConfig('https://host', 'ACxxx', 'token', '+15550000000')
  const registry = new VoiceBotRegistry()
  registry.register({ name: 'DefaultBot', mindset: DefaultBot }, { default: true })

  let capturedIntent: { bot?: string; greeting?: string } | undefined
  const intents = {
    create: (intent: { bot?: string; greeting?: string }) => {
      capturedIntent = intent
      return 'INTENT1'
    },
    take: () => undefined,
  }

  const service = new TwilioCallService(config, registry, intents as unknown as OutboundCallIntents)
  let created: { to: string; from: string; url: string } | undefined
  ;(service as unknown as { createCall: (p: any) => Promise<{ sid: string }> }).createCall = async (
    p,
  ) => {
    created = p
    return { sid: 'CA123' }
  }

  return { service, getIntent: () => capturedIntent, getCreated: () => created }
}

// Consent is the application's responsibility — the service just dials.
test.describe('TwilioCallService.initiate', () => {
  test('normalizes the number, dials, and returns the sid', async () => {
    const { service, getIntent, getCreated } = setup()

    const result = await service.initiate({ to: '3001112233', greeting: 'Saluda' })

    assert.deepEqual(getIntent(), { bot: 'DefaultBot', greeting: 'Saluda', voice: undefined })
    assert.equal(getCreated()?.to, '+573001112233')
    assert.equal(getCreated()?.from, '+15550000000')
    assert.equal(getCreated()?.url, 'https://host/voice/twilio/incoming?intent=INTENT1')
    assert.deepEqual(result, { callId: 'CA123', to: '+573001112233' })
  })

  test('routes to an explicitly named bot', async () => {
    const { service, getIntent } = setup()
    await service.initiate({ to: '+573001112233', bot: 'Sales' })
    assert.equal(getIntent()?.bot, 'Sales')
  })
})
