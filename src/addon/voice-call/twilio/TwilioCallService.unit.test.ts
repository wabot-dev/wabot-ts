import test from 'node:test'
import assert from 'node:assert/strict'
import { Mindset } from '@/feature/mindset'
import { OutboundCallIntents, VoiceBotRegistry } from '@/feature/voice-call'
import { TwilioAccountRegistry } from './TwilioAccountRegistry'
import { TwilioCallService } from './TwilioCallService'
import { TwilioVoiceConfig } from './TwilioVoiceConfig'

class DefaultBot extends Mindset {}

function setup() {
  const config = new TwilioVoiceConfig({
    publicBaseUrl: 'https://host',
    accountSid: 'ACxxx',
    authToken: 'token',
    fromNumber: '+15550000000',
  })
  const registry = new VoiceBotRegistry()
  registry.register({ name: 'DefaultBot', mindset: DefaultBot }, { default: true })

  const accounts = new TwilioAccountRegistry()
  // Two accounts, each with its own caller-ID number and credentials.
  accounts.register({ accountSid: 'AC_one', authToken: 'tok_one', numbers: ['+15550000000'] })
  accounts.register({ accountSid: 'AC_two', authToken: 'tok_two', numbers: ['+15551112222'] })

  let capturedIntent: { bot?: string; greeting?: string } | undefined
  const intents = {
    create: (intent: { bot?: string; greeting?: string }) => {
      capturedIntent = intent
      return 'INTENT1'
    },
    take: () => undefined,
  }

  const service = new TwilioCallService(
    config,
    registry,
    intents as unknown as OutboundCallIntents,
    accounts,
  )
  let created:
    | { to: string; from: string; url: string; accountSid: string; authToken: string }
    | undefined
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
  test('normalizes the number, dials from the default account, and returns the sid', async () => {
    const { service, getIntent, getCreated } = setup()

    const result = await service.initiate({ to: '3001112233', greeting: 'Saluda' })

    assert.deepEqual(getIntent(), { bot: 'DefaultBot', greeting: 'Saluda', voice: undefined })
    assert.equal(getCreated()?.to, '+573001112233')
    assert.equal(getCreated()?.from, '+15550000000')
    assert.equal(getCreated()?.accountSid, 'AC_one')
    assert.equal(getCreated()?.authToken, 'tok_one')
    assert.equal(getCreated()?.url, 'https://host/voice/twilio/incoming?intent=INTENT1')
    assert.deepEqual(result, { callId: 'CA123', to: '+573001112233' })
  })

  test('dials from an explicit number with that account\'s credentials', async () => {
    const { service, getCreated } = setup()
    await service.initiate({ to: '+573001112233', from: '+15551112222' })
    assert.equal(getCreated()?.from, '+15551112222')
    assert.equal(getCreated()?.accountSid, 'AC_two')
    assert.equal(getCreated()?.authToken, 'tok_two')
  })

  test('rejects a from-number that belongs to no registered account', async () => {
    const { service } = setup()
    await assert.rejects(
      () => service.initiate({ to: '+573001112233', from: '+15559998888' }),
      /No Twilio account registered/,
    )
  })

  test('routes to an explicitly named bot', async () => {
    const { service, getIntent } = setup()
    await service.initiate({ to: '+573001112233', bot: 'Sales' })
    assert.equal(getIntent()?.bot, 'Sales')
  })
})
