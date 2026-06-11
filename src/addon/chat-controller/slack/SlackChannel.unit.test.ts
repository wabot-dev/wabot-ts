import test from 'node:test'
import assert from 'node:assert/strict'
import { SlackChannel } from './SlackChannel'
import { SlackChannelConfig } from './SlackChannelConfig'
import { IChatMessage, IChatMessageFile } from '@/feature/chat-bot'

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
  message: {
    senderId?: string
    senderName?: string
    text?: string
    images?: IChatMessageFile[]
    documents?: IChatMessageFile[]
  }
  reply?: (msg: IChatMessage) => Promise<Record<string, string> | void>
}

async function captureMessage(
  channelType: string | undefined,
  extras: Record<string, unknown> = {},
): Promise<CapturedMessage> {
  const channel = makeChannel()
  let captured: CapturedMessage | null = null

  channel.listen(async (m): Promise<void> => {
    captured = {
      channel: m.channel,
      chatConnection: m.chatConnection,
      message: {
        senderId: m.message.senderId,
        senderName: m.message.senderName,
        text: m.message.text,
        images: m.message.images,
        documents: m.message.documents,
      },
      reply: m.reply,
    }
  })

  const say = async () => undefined
  await callHandleMessage(channel, {
    message: {
      channel: 'C123',
      channel_type: channelType,
      user: 'U1',
      text: 'hi',
      ts: '1700000000.000100',
      ...extras,
    },
    say,
  })

  assert.ok(captured, 'callback was not invoked')
  return captured
}

function withFetch<T>(impl: typeof fetch, fn: () => Promise<T>): Promise<T> {
  const original = globalThis.fetch
  globalThis.fetch = impl
  return fn().finally(() => {
    globalThis.fetch = original
  })
}

function okResponse(body: string, contentType = 'application/octet-stream'): Response {
  return {
    ok: true,
    headers: {
      get: (name: string) =>
        (name.toLowerCase() === 'content-type' ? contentType : null) as string | null,
    },
    async arrayBuffer() {
      return new TextEncoder().encode(body).buffer
    },
  } as unknown as Response
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

  // ----- File attachment support -----

  test('T1: downloads PNG attachment into images[] as base64 data URL', async () => {
    const channel = makeChannel()
    let captured: CapturedMessage | null = null
    channel.listen(async (m): Promise<void> => {
      captured = {
        channel: m.channel,
        chatConnection: m.chatConnection,
        message: {
          senderId: m.message.senderId,
          senderName: m.message.senderName,
          text: m.message.text,
          images: m.message.images,
          documents: m.message.documents,
        },
        reply: m.reply,
      }
    })

    await withFetch(
      async () => okResponse('png-bytes', 'image/png'),
      () =>
        callHandleMessage(channel, {
          message: {
            channel: 'C123',
            channel_type: 'im',
            user: 'U1',
            text: '',
            ts: '1700000000.000200',
            subtype: 'file_share',
            files: [
              {
                id: 'F1',
                name: 'cat.png',
                mimetype: 'image/png',
                url_private: 'https://x',
                size: 8,
              },
            ],
          },
          say: async () => undefined,
        }),
    )

    assert.ok(captured)
    const m = captured as CapturedMessage
    assert.equal(m.message.documents, undefined)
    assert.equal(m.message.images?.length, 1)
    assert.deepEqual(m.message.images![0], {
      id: 'F1',
      name: 'cat.png',
      mimeType: 'image/png',
      base64Url: 'data:image/png;base64,cG5nLWJ5dGVz',
    })
  })

  test('T2: PDF attachment lands in documents[]', async () => {
    const channel = makeChannel()
    let captured: CapturedMessage | null = null
    channel.listen(async (m): Promise<void> => {
      captured = {
        channel: m.channel,
        chatConnection: m.chatConnection,
        message: {
          senderId: m.message.senderId,
          senderName: m.message.senderName,
          text: m.message.text,
          images: m.message.images,
          documents: m.message.documents,
        },
        reply: m.reply,
      }
    })

    await withFetch(
      async () => okResponse('pdf-bytes', 'application/pdf'),
      () =>
        callHandleMessage(channel, {
          message: {
            channel: 'C123',
            channel_type: 'im',
            user: 'U1',
            text: '',
            ts: '1700000000.000201',
            subtype: 'file_share',
            files: [
              {
                id: 'F2',
                name: 'report.pdf',
                mimetype: 'application/pdf',
                url_private: 'https://x',
                size: 100,
              },
            ],
          },
          say: async () => undefined,
        }),
    )

    assert.ok(captured)
    const m = captured as CapturedMessage
    assert.equal(m.message.images, undefined)
    assert.equal(m.message.documents?.length, 1)
    assert.equal(m.message.documents![0].name, 'report.pdf')
    assert.equal(m.message.documents![0].mimeType, 'application/pdf')
    assert.match(m.message.documents![0].base64Url ?? '', /^data:application\/pdf;base64,/)
  })

  test('T3: ignores files when subtype is not file_share', async () => {
    const channel = makeChannel()
    let captured: any = null
    channel.listen(async (m) => {
      captured = m.message
    })

    await withFetch(
      async () => okResponse('x'),
      () =>
        callHandleMessage(channel, {
          message: {
            channel: 'C123',
            channel_type: 'im',
            user: 'U1',
            text: 'no files',
            subtype: 'thread_broadcast',
            files: [{ id: 'F3', mimetype: 'image/png', url_private: 'https://x', size: 1 }],
          },
          say: async () => undefined,
        }),
    )

    assert.equal(captured, null)
  })

  test('T4: image sent with generic file mime routes to images[]', async () => {
    const channel = makeChannel()
    let captured: CapturedMessage | null = null
    channel.listen(async (m): Promise<void> => {
      captured = {
        channel: m.channel,
        chatConnection: m.chatConnection,
        message: {
          senderId: m.message.senderId,
          senderName: m.message.senderName,
          text: m.message.text,
          images: m.message.images,
          documents: m.message.documents,
        },
        reply: m.reply,
      }
    })

    await withFetch(
      async () => okResponse('png', 'image/png'),
      () =>
        callHandleMessage(channel, {
          message: {
            channel: 'C123',
            channel_type: 'im',
            user: 'U1',
            text: '',
            ts: '1700000000.000202',
            subtype: 'file_share',
            files: [
              {
                id: 'F4',
                name: 'shot.png',
                mimetype: 'image/png',
                url_private: 'https://x',
                size: 3,
              },
            ],
          },
          say: async () => undefined,
        }),
    )

    assert.ok(captured)
    const m = captured as CapturedMessage
    assert.equal(m.message.documents, undefined)
    assert.equal(m.message.images?.length, 1)
    assert.equal(m.message.images![0].mimeType, 'image/png')
  })

  test('T5: fetch 500 omits the file and continues with text only', async () => {
    const channel = makeChannel()
    let captured: CapturedMessage | null = null
    channel.listen(async (m): Promise<void> => {
      captured = {
        channel: m.channel,
        chatConnection: m.chatConnection,
        message: {
          senderId: m.message.senderId,
          senderName: m.message.senderName,
          text: m.message.text,
          images: m.message.images,
          documents: m.message.documents,
        },
        reply: m.reply,
      }
    })

    await withFetch(
      async () => ({ ok: false, status: 500, statusText: 'Server Error' }) as Response,
      () =>
        callHandleMessage(channel, {
          message: {
            channel: 'C123',
            channel_type: 'im',
            user: 'U1',
            text: 'hi',
            ts: '1700000000.000203',
            subtype: 'file_share',
            files: [{ id: 'F5', mimetype: 'image/png', url_private: 'https://x', size: 1 }],
          },
          say: async () => undefined,
        }),
    )

    assert.ok(captured)
    const m = captured as CapturedMessage
    assert.equal(m.message.text, 'hi')
    assert.equal(m.message.images, undefined)
    assert.equal(m.message.documents, undefined)
  })

  test('T6: file larger than 20 MB is skipped', async () => {
    const channel = makeChannel()
    let fetchCalled = false
    let captured: any = null
    channel.listen(async (m) => {
      captured = m.message
    })

    await withFetch(
      async () => {
        fetchCalled = true
        return okResponse('x')
      },
      () =>
        callHandleMessage(channel, {
          message: {
            channel: 'C123',
            channel_type: 'im',
            user: 'U1',
            text: 'big',
            ts: '1700000000.000204',
            subtype: 'file_share',
            files: [
              { id: 'F6', mimetype: 'image/png', url_private: 'https://x', size: 25 * 1024 * 1024 },
            ],
          },
          say: async () => undefined,
        }),
    )

    assert.equal(fetchCalled, false)
    assert.ok(captured)
    assert.equal(captured.images, undefined)
    assert.equal(captured.documents, undefined)
  })

  test('T7: file without url_private is skipped', async () => {
    const channel = makeChannel()
    let fetchCalled = false
    let captured: any = null
    channel.listen(async (m) => {
      captured = m.message
    })

    await withFetch(
      async () => {
        fetchCalled = true
        return okResponse('x')
      },
      () =>
        callHandleMessage(channel, {
          message: {
            channel: 'C123',
            channel_type: 'im',
            user: 'U1',
            text: 'no-url',
            ts: '1700000000.000205',
            subtype: 'file_share',
            files: [{ id: 'F7', mimetype: 'image/png', size: 1 }],
          },
          say: async () => undefined,
        }),
    )

    assert.equal(fetchCalled, false)
    assert.equal(captured.images, undefined)
  })

  // ----- Threading -----

  test('T8: reply uses message.thread_ts when the original message was already in a thread', async () => {
    const channel = makeChannel()
    const says: any[] = []
    channel.listen(async (m) => {
      await m.reply({ text: 'pong' })
    })

    await callHandleMessage(channel, {
      message: {
        channel: 'C123',
        channel_type: 'channel',
        user: 'U1',
        text: 'ping',
        ts: '1700000000.000300',
        thread_ts: '1700000000.000000',
      },
      say: async (args: any) => {
        says.push(args)
      },
    })

    assert.equal(says[0].thread_ts, '1700000000.000000')
  })

  test('T9: top-level reply uses message.ts as thread_ts', async () => {
    const channel = makeChannel()
    const says: any[] = []
    channel.listen(async (m) => {
      await m.reply({ text: 'pong' })
    })

    await callHandleMessage(channel, {
      message: {
        channel: 'C123',
        channel_type: 'channel',
        user: 'U1',
        text: 'ping',
        ts: '1700000000.000400',
      },
      say: async (args: any) => {
        says.push(args)
      },
    })

    assert.equal(says[0].thread_ts, '1700000000.000400')
  })

  test('T10: caption with image preserves both text and images[]', async () => {
    const channel = makeChannel()
    const capture: CapturedMessage[] = []
    channel.listen(async (m) => {
      capture.push({
        channel: m.channel,
        chatConnection: m.chatConnection,
        message: {
          senderId: m.message.senderId,
          senderName: m.message.senderName,
          text: m.message.text,
          images: m.message.images,
          documents: m.message.documents,
        },
        reply: m.reply,
      })
      return
    })

    await withFetch(
      async () => okResponse('png', 'image/png'),
      () =>
        callHandleMessage(channel, {
          message: {
            channel: 'C123',
            channel_type: 'im',
            user: 'U1',
            text: 'que es esto?',
            ts: '1700000000.000500',
            subtype: 'file_share',
            files: [{ id: 'F10', mimetype: 'image/png', url_private: 'https://x', size: 3 }],
          },
          say: async () => undefined,
        }),
    )

    assert.equal(capture.length, 1)
    const m = capture[0]!
    assert.equal(m.message.text, 'que es esto?')
    assert.equal(m.message.images?.length, 1)
  })

  test('T11: multiple images are downloaded in order and kept as images[]', async () => {
    const channel = makeChannel()
    const capture: CapturedMessage[] = []
    channel.listen(async (m) => {
      capture.push({
        channel: m.channel,
        chatConnection: m.chatConnection,
        message: {
          senderId: m.message.senderId,
          senderName: m.message.senderName,
          text: m.message.text,
          images: m.message.images,
          documents: m.message.documents,
        },
        reply: m.reply,
      })
      return
    })

    let n = 0
    await withFetch(
      async () => okResponse(`img${n++}`, 'image/png'),
      () =>
        callHandleMessage(channel, {
          message: {
            channel: 'C123',
            channel_type: 'im',
            user: 'U1',
            text: '',
            ts: '1700000000.000600',
            subtype: 'file_share',
            files: [
              { id: 'A', mimetype: 'image/png', url_private: 'https://x/1', size: 1 },
              { id: 'B', mimetype: 'image/png', url_private: 'https://x/2', size: 1 },
              { id: 'C', mimetype: 'image/png', url_private: 'https://x/3', size: 1 },
              { id: 'D', mimetype: 'image/png', url_private: 'https://x/4', size: 1 },
              { id: 'E', mimetype: 'image/png', url_private: 'https://x/5', size: 1 },
            ],
          },
          say: async () => undefined,
        }),
    )

    assert.equal(capture.length, 1)
    const m = capture[0]!
    assert.equal(m.message.images?.length, 5)
    assert.deepEqual(
      m.message.images!.map((x) => x.id),
      ['A', 'B', 'C', 'D', 'E'],
    )
  })
})
