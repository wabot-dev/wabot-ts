import test from 'node:test'
import assert from 'node:assert/strict'

import { HubSpotChannel } from './HubSpotChannel'
import { HubSpotChannelConfig } from './HubSpotChannelConfig'
import { IHubSpotMessagePayload } from './IHubSpotMessagePayload'
import { IHubSpotMessageListener } from './HubSpotWebhookController'
import { IHubSpotChannelMessage } from './IHubSpotChannelMessage'

const CONFIG = new HubSpotChannelConfig({
  accessToken: 'tok',
  webhookSecret: 'sec',
  webhookPath: '/hubspot/webhook/test',
  appId: 'app-1',
})

function makeChannel() {
  // Env is only consulted when config fields are missing; our CONFIG has all of them.
  const env = { requireString: (name: string) => '' } as any
  return new HubSpotChannel(CONFIG, env)
}

function getReceiverListener(channel: HubSpotChannel): IHubSpotMessageListener {
  const receiver = (channel as any).receiver as { listener: IHubSpotMessageListener | null }
  if (!receiver.listener) throw new Error('listener not registered; call channel.listen() first')
  return receiver.listener
}

function replaceSender(channel: HubSpotChannel, recorder: { calls: any[] }) {
  const sender = (channel as any).sender as { sendMessage: (req: any) => Promise<any> }
  sender.sendMessage = async (req) => {
    recorder.calls.push(req)
    return { messageId: 'mock_id' }
  }
}

const basePayload: IHubSpotMessagePayload = {
  threadId: 'thr-1',
  messageId: 'm-1',
  senderId: 'visitor-1',
  senderName: 'Alice',
  channel: 'EMAIL',
  text: 'hola wabot',
  files: [],
  metadata: { subscriptionType: 'conversation.creation' },
}

test.describe('HubSpotChannel', () => {
  test('listen delivers a normalized IHubSpotChannelMessage from the receiver payload', async () => {
    const channel = makeChannel()
    let received: IHubSpotChannelMessage | null = null
    channel.listen(async (msg) => {
      received = msg
    })

    const listener = getReceiverListener(channel)
    await listener(basePayload)

    assert.ok(received, 'callback should have been invoked')
    const msg = received as unknown as IHubSpotChannelMessage
    assert.equal(msg.channel, 'HubSpotChannel')
    assert.equal(msg.chatConnection.id, 'thr-1')
    assert.equal(msg.chatConnection.chatType, 'PRIVATE')
    assert.equal(msg.chatConnection.channelName, 'HubSpotChannel')
    assert.equal(msg.message.senderId, 'visitor-1')
    assert.equal(msg.message.senderName, 'Alice')
    assert.equal(msg.message.text, 'hola wabot')
    assert.equal(msg.message.metadata?.subscriptionType, 'conversation.creation')
  })

  test('reply forwards the text and threadId to the sender', async () => {
    const channel = makeChannel()
    const recorder = { calls: [] as any[] }
    replaceSender(channel, recorder)

    let received: IHubSpotChannelMessage | null = null
    channel.listen(async (msg) => {
      received = msg
    })
    await getReceiverListener(channel)(basePayload)

    const replyFn = (received as unknown as IHubSpotChannelMessage).reply
    await replyFn({ text: 'respuesta wabot' } as any)

    assert.equal(recorder.calls.length, 1)
    assert.equal(recorder.calls[0].threadId, 'thr-1')
    assert.equal(recorder.calls[0].text, 'respuesta wabot')
    // Plain text without markdown should still be rendered as richText so HubSpot
    // formats it consistently with messages that do contain markdown.
    assert.equal(recorder.calls[0].richText, 'respuesta wabot')
  })

  test('reply converts markdown text into HubSpot HTML rich text', async () => {
    const channel = makeChannel()
    const recorder = { calls: [] as any[] }
    replaceSender(channel, recorder)

    let received: IHubSpotChannelMessage | null = null
    channel.listen(async (msg) => {
      received = msg
    })
    await getReceiverListener(channel)(basePayload)

    const replyFn = (received as unknown as IHubSpotChannelMessage).reply
    await replyFn({ text: '**bold** and `code`' } as any)

    assert.equal(recorder.calls[0].text, '**bold** and `code`')
    assert.equal(recorder.calls[0].richText, '<b>bold</b> and <code>code</code>')
  })

  test('reply omits richText when there is no text', async () => {
    const channel = makeChannel()
    const recorder = { calls: [] as any[] }
    replaceSender(channel, recorder)

    let received: IHubSpotChannelMessage | null = null
    channel.listen(async (msg) => {
      received = msg
    })
    await getReceiverListener(channel)(basePayload)

    const replyFn = (received as unknown as IHubSpotChannelMessage).reply
    await replyFn({ images: [] } as any)

    assert.equal(recorder.calls[0].text, undefined)
    assert.equal(recorder.calls[0].richText, undefined)
  })

  test('disconnect is a safe no-op', () => {
    const channel = makeChannel()
    assert.doesNotThrow(() => channel.disconnect())
  })
})
