import test from 'node:test'
import assert from 'node:assert/strict'
import { container } from '@/core/injection'
import { VoiceControllerMetadataStore } from '@/feature/voice-call'
import { InitiateCallTools } from './InitiateCallTools'
import { TwilioAccountRegistry } from './TwilioAccountRegistry'
import { TwilioCalls } from './TwilioCalls'
import { TwilioCallService } from './TwilioCallService'
import { TwilioVoiceChannel } from './TwilioVoiceChannel'
import { TwilioVoiceConfig } from './TwilioVoiceConfig'

// These drive the real public path — TwilioCalls.initiate / an injected
// TwilioCalls — and capture the outbound Twilio REST call. TwilioCallService's
// own unit test builds the service with `new`, so the container + selection path
// (where the singleton-collision bug lived) is only covered here.

class PqrsVoiceController {}
class SaludVoiceController {}

const originalFetch = globalThis.fetch
test.afterEach(() => void (globalThis.fetch = originalFetch))

/** Intercept the Twilio REST dial and record the {To, From, Url} it posts. */
function captureDial(): { posts: { to: string; from: string; url: string }[] } {
  const posts: { to: string; from: string; url: string }[] = []
  globalThis.fetch = (async (_input: unknown, init: { body: URLSearchParams }) => {
    const body = init.body
    posts.push({
      to: body.get('To') ?? '',
      from: body.get('From') ?? '',
      url: body.get('Url') ?? '',
    })
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ sid: 'CA123' }),
      text: async () => '',
    }
  }) as typeof fetch
  return { posts }
}

function declareChannel(
  store: VoiceControllerMetadataStore,
  ctor: Function,
  webhookPath: string,
  numbers: string[] = [],
) {
  store.saveVoiceControllerMetadata({ controllerConstructor: ctor })
  store.saveVoiceChannelMetadata({
    controllerConstructor: ctor as any,
    functionName: 'onCall',
    channelConstructor: TwilioVoiceChannel,
    channelConfig: new TwilioVoiceConfig({ publicBaseUrl: 'https://host', webhookPath, numbers }),
  })
}

/** A TwilioCalls over a fresh store — the real one is a process-wide singleton. */
function twilioCalls(declare: (store: VoiceControllerMetadataStore) => void): TwilioCalls {
  const store = new VoiceControllerMetadataStore()
  declare(store)
  return new TwilioCalls(store)
}

// The service resolves accounts from the ROOT registry (it's built in a child of
// the root container), so caller-ID numbers must be registered there.
const accounts = container.resolve(TwilioAccountRegistry)
for (const number of ['+576011110000', '+576012220000', '+15550000000']) {
  accounts.register({ accountSid: 'AC', authToken: 'tok', numbers: [number] })
}

test.describe('TwilioCalls channel selection', () => {
  test('from selects the channel that declares it', async () => {
    const calls = twilioCalls((s) => {
      declareChannel(s, PqrsVoiceController, '/voice/pqrs/incoming', ['+576011110000'])
      declareChannel(s, SaludVoiceController, '/voice/salud/incoming', ['+576012220000'])
    })

    const dial = captureDial()
    await calls.initiate({ to: '+573001112233', from: '+576011110000', greeting: 'x' })
    await calls.initiate({ to: '+573001112233', from: '+576012220000', greeting: 'x' })

    // The regression this guards: as a @singleton the second call reused the
    // first config and both dialed /voice/pqrs/incoming.
    assert.match(dial.posts[0]!.url, /^https:\/\/host\/voice\/pqrs\/incoming\?/)
    assert.match(dial.posts[1]!.url, /^https:\/\/host\/voice\/salud\/incoming\?/)
  })

  test('from is matched format-insensitively', async () => {
    const calls = twilioCalls((s) => {
      declareChannel(s, PqrsVoiceController, '/voice/pqrs/incoming', ['+576011110000'])
      declareChannel(s, SaludVoiceController, '/voice/salud/incoming', ['+576012220000'])
    })

    const dial = captureDial()
    await calls.initiate({ to: '+573001112233', from: '576011110000', greeting: 'x' })

    assert.match(dial.posts[0]!.url, /voice\/pqrs\/incoming/)
    assert.equal(dial.posts[0]!.from, '+576011110000')
  })

  test('a single channel answers regardless of from', async () => {
    const calls = twilioCalls((s) => declareChannel(s, PqrsVoiceController, '/voice/pqrs/incoming'))

    const dial = captureDial()
    await calls.initiate({ to: '+573001112233', from: '+15550000000', greeting: 'x' })

    assert.match(dial.posts[0]!.url, /voice\/pqrs\/incoming/)
  })

  test('no channel declared falls back to the environment config', async () => {
    const calls = twilioCalls(() => {})

    const dial = captureDial()
    await calls.initiate({ to: '+573001112233', from: '+15550000000', greeting: 'x' })

    assert.match(dial.posts[0]!.url, /voice\/twilio\/incoming/)
  })

  test('several channels with an unmatched from throws, listing the channels', async () => {
    const calls = twilioCalls((s) => {
      declareChannel(s, PqrsVoiceController, '/voice/pqrs/incoming', ['+576011110000'])
      declareChannel(s, SaludVoiceController, '/voice/salud/incoming', ['+576012220000'])
    })

    await assert.rejects(
      () => calls.initiate({ to: '+573001112233', from: '+15559999999' }),
      // lists the declared channels so the fix is obvious
      /No @twilioVoice channel serves the caller-ID \+15559999999.*salud/s,
    )
  })

  test('several channels with from omitted throws asking for from', async () => {
    const calls = twilioCalls((s) => {
      declareChannel(s, PqrsVoiceController, '/voice/pqrs/incoming', ['+576011110000'])
      declareChannel(s, SaludVoiceController, '/voice/salud/incoming', ['+576012220000'])
    })

    await assert.rejects(() => calls.initiate({ to: '+573001112233' }), /pass a `from` number/)
  })
})

// Resolving from the real root container, the way a @commandHandler / REST
// controller / cron job does. Both of these threw `TypeInfo not known for
// "Object"` before this fix.
test.describe('outbound resolution outside a voice channel', () => {
  declareChannel(
    container.resolve(VoiceControllerMetadataStore),
    PqrsVoiceController,
    '/voice/pqrs/incoming',
    ['+576011110000'],
  )

  test('container.resolve(TwilioCallService) resolves with the declared config', () => {
    const service = container.resolve(TwilioCallService)
    assert.equal((service as unknown as { config: TwilioVoiceConfig }).config.webhookPath, '/voice/pqrs/incoming')
  })

  test('static TwilioCalls.initiate dials the declared channel without the container', async () => {
    const dial = captureDial()
    const result = await TwilioCalls.initiate({ to: '+573001112233', from: '+576011110000', greeting: 'x' })

    assert.equal(result.callId, 'CA123')
    assert.equal(dial.posts[0]!.to, '+573001112233')
    assert.match(dial.posts[0]!.url, /^https:\/\/host\/voice\/pqrs\/incoming\?intent=/)
  })

  test('InitiateCallTools resolves and dials through TwilioCalls', async () => {
    const dial = captureDial()
    const tools = container.resolve(InitiateCallTools)
    const result = await tools.iniciarLlamada({ telefono: '+573001112233', objetivo: 'Saluda' })

    assert.equal(result.estado, 'iniciando')
    assert.match(dial.posts[0]!.url, /voice\/pqrs\/incoming/)
  })
})
