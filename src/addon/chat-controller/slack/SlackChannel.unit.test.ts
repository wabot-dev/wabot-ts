import test from 'node:test'
import assert from 'node:assert/strict'
import { SlackChannel } from './SlackChannel'
import { SlackChannelConfig } from './SlackChannelConfig'

const APP_TOKEN = 'xapp-1-A0-FAKE'
const BOT_TOKEN = 'xoxb-fake'

function makeChannel() {
  const channel = new SlackChannel(new SlackChannelConfig(APP_TOKEN, BOT_TOKEN))
  // Stub users.info so the real WebClient never talks to Slack during unit tests.
  ;(channel as any).app.client = {
    users: {
      info: async () => ({ ok: true, user: { real_name: 'Real Name', name: 'username' } }),
    },
  }
  return channel
}

const callHandleMessage = (channel: SlackChannel, args: any) =>
  (channel as any).handleMessage(args) as Promise<void>

interface CapturedMessage {
  channel: string
  chatConnection: { id: string; chatType: 'GROUP' | 'PRIVATE'; channelName: string }
  message: { senderId?: string; senderName?: string; text?: string }
}

async function captureMessage(channelType: string | undefined): Promise<CapturedMessage> {
  const channel = makeChannel()
  let captured: CapturedMessage | null = null

  channel.listen(async (m) => {
    captured = {
      channel: m.channel,
      chatConnection: m.chatConnection,
      message: {
        senderId: m.message.senderId,
        senderName: m.message.senderName,
        text: m.message.text,
      },
    }
  })

  const say = async () => undefined
  await callHandleMessage(channel, {
    message: {
      channel: 'C123',
      channel_type: channelType,
      user: 'U1',
      text: 'hi',
    },
    say,
  })

  assert.ok(captured, 'callback was not invoked')
  return captured
}

test.describe('SlackChannel.handleMessage', () => {
  test('maps channel_type "channel" to GROUP', async () => {
    const m = await captureMessage('channel')
    assert.equal(m.chatConnection.chatType, 'GROUP')
    assert.equal(m.chatConnection.id, 'C123')
    assert.equal(m.chatConnection.channelName, 'SlackChannel')
  })

  test('maps channel_type "group" to GROUP', async () => {
    const m = await captureMessage('group')
    assert.equal(m.chatConnection.chatType, 'GROUP')
  })

  test('maps channel_type "mpim" to GROUP', async () => {
    const m = await captureMessage('mpim')
    assert.equal(m.chatConnection.chatType, 'GROUP')
  })

  test('maps channel_type "im" to PRIVATE', async () => {
    const m = await captureMessage('im')
    assert.equal(m.chatConnection.chatType, 'PRIVATE')
  })

  test('defaults to GROUP when channel_type is missing', async () => {
    const m = await captureMessage(undefined)
    assert.equal(m.chatConnection.chatType, 'GROUP')
  })

  test('ignores message subtypes other than file_share', async () => {
    const channel = makeChannel()
    let invoked = false
    channel.listen(async () => {
      invoked = true
    })

    await callHandleMessage(channel, {
      message: {
        channel: 'C123',
        channel_type: 'channel',
        user: 'U1',
        text: 'old',
        subtype: 'thread_broadcast',
      },
      say: async () => undefined,
    })

    assert.equal(invoked, false)
  })

  test('accepts file_share subtype (file attachments)', async () => {
    const channel = makeChannel()
    let invoked = false
    channel.listen(async () => {
      invoked = true
    })

    await callHandleMessage(channel, {
      message: {
        channel: 'C123',
        channel_type: 'channel',
        user: 'U1',
        text: '',
        subtype: 'file_share',
      },
      say: async () => undefined,
    })

    assert.equal(invoked, true)
  })

  test('passes senderId and text through to the framework message', async () => {
    const m = await captureMessage('channel')
    assert.equal(m.message.senderId, 'U1')
    assert.equal(m.message.text, 'hi')
  })

  test('falls back to userId when users.info fails to resolve a real name', async () => {
    const channel = makeChannel()
    let captured: any = null
    channel.listen(async (m) => {
      captured = m.message
    })
    ;(channel as any).app.client = {
      users: {
        info: async () => {
          throw new Error('users.info offline')
        },
      },
    }

    await callHandleMessage(channel, {
      message: { channel: 'C123', channel_type: 'im', user: 'U42', text: 'x' },
      say: async () => undefined,
    })

    assert.equal(captured.senderName, 'U42')
  })
})
