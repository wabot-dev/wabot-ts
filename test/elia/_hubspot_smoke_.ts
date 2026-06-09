// Smoke test for the HubSpot channel: spins up the framework's Express app
// with the webhook route registered and exercises a signed POST end-to-end
// without touching HubSpot. Run with:
//   PORT=3344 node --import @yucacodes/ts ./test/elia/_hubspot_smoke_.ts

import { createHmac } from 'node:crypto'
import { Env, container, ExpressProvider, runRestControllers } from '@'
import { HubSpotChannel, HubSpotChannelConfig, IHubSpotMessagePayload } from '@'

const WEBHOOK_PATH = '/hubspot/webhook/smoke'
const SECRET = 'smoke-client-secret'
const PORT = Number(process.env.PORT ?? 3344)

async function main() {
  const env = container.resolve(Env)
  const expressProvider = container.resolve(ExpressProvider)
  const config = new HubSpotChannelConfig({
    accessToken: 'smoke-token',
    webhookSecret: SECRET,
    webhookPath: WEBHOOK_PATH,
  })

  const channel = new HubSpotChannel(config, env)
  const received: IHubSpotMessagePayload[] = []
  channel.listen(async (msg) => {
    received.push({
      threadId: msg.chatConnection.id,
      messageId: '',
      senderId: msg.message.senderId ?? '',
      senderName: msg.message.senderName,
      text: msg.message.text,
      files: msg.message.images ?? [],
      channel: msg.message.metadata?.channel,
      metadata: msg.message.metadata ?? {},
    })
  })
  channel.connect()
  // runRestControllers was already called inside channel.connect() via the
  // receiver, but call again is safe (idempotent per route). Calling it once
  // explicitly here is what actually triggers expressProvider.listen().
  runRestControllers([])
  expressProvider.listen()

  const baseUrl = `http://127.0.0.1:${PORT}`
  await waitForServer(baseUrl)

  const body = JSON.stringify([
    {
      subscriptionType: 'conversation.creation',
      portalId: 12345,
      appId: 1,
      objectId: 'thread-abc',
      message: {
        id: 'm-1',
        threadId: 'thread-abc',
        direction: 'INCOMING',
        channel: 'EMAIL',
        text: 'hola desde smoke',
        from: { actorId: 'visitor-1', name: 'Smoke Visitor' },
      },
    },
  ])
  const timestamp = Date.now()
  const signature = signV3(SECRET, 'POST', WEBHOOK_PATH, body, timestamp)

  const okRes = await fetch(`${baseUrl}${WEBHOOK_PATH}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-HubSpot-Signature-v3': signature,
      'X-HubSpot-Request-Timestamp': String(timestamp),
    },
    body,
  })
  if (okRes.status !== 200) {
    const txt = await okRes.text()
    throw new Error(`expected 200 for valid signature, got ${okRes.status}: ${txt}`)
  }
  if (received.length !== 1) {
    throw new Error(`expected 1 received message, got ${received.length}`)
  }
  if (received[0].text !== 'hola desde smoke') {
    throw new Error(`unexpected text: ${received[0].text}`)
  }
  console.log('OK  valid signature: 200 + listener invoked with text="' + received[0].text + '"')

  const badRes = await fetch(`${baseUrl}${WEBHOOK_PATH}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-HubSpot-Signature-v3': 'bogus',
      'X-HubSpot-Request-Timestamp': String(timestamp),
    },
    body,
  })
  if (badRes.status !== 401) {
    const txt = await badRes.text()
    throw new Error(`expected 401 for invalid signature, got ${badRes.status}: ${txt}`)
  }
  console.log('OK  invalid signature: 401')

  const stale = Date.now() - 10 * 60 * 1000
  const staleSig = signV3(SECRET, 'POST', WEBHOOK_PATH, body, stale)
  const staleRes = await fetch(`${baseUrl}${WEBHOOK_PATH}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-HubSpot-Signature-v3': staleSig,
      'X-HubSpot-Request-Timestamp': String(stale),
    },
    body,
  })
  if (staleRes.status !== 401) {
    throw new Error(`expected 401 for stale timestamp, got ${staleRes.status}`)
  }
  console.log('OK  stale timestamp: 401')

  channel.disconnect()
  console.log('\nSmoke test passed.')
  process.exit(0)
}

function signV3(secret: string, method: string, url: string, body: string, ts: number): string {
  return createHmac('sha256', secret).update(`${method}${url}${body}${ts}`).digest('base64')
}

async function waitForServer(baseUrl: string, attempts = 20): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(baseUrl, { method: 'GET' })
      // Any response (even 404) means the server is up.
      if (res.status > 0) return
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error(`server did not start at ${baseUrl}`)
}

main().catch((err) => {
  console.error('smoke failed:', err)
  process.exit(1)
})
