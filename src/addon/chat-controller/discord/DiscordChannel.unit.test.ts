import test from 'node:test'
import assert from 'node:assert/strict'
import { GatewayIntentBits, StickerFormatType } from 'discord.js'
import { DiscordChannel } from './DiscordChannel'
import { DiscordChannelConfig } from './DiscordChannelConfig'

const BOT_TOKEN = 'fake-token'
const BOT_USER_ID = 'bot-user-id'

function makeChannel(intents?: GatewayIntentBits[]): DiscordChannel {
  return new DiscordChannel(new DiscordChannelConfig(BOT_TOKEN, intents))
}

function withFetch<T>(impl: typeof fetch, fn: () => Promise<T>): Promise<T> {
  const original = globalThis.fetch
  globalThis.fetch = impl
  return fn().finally(() => {
    globalThis.fetch = original
  })
}

function okResponse(body: string): Response {
  return {
    ok: true,
    async arrayBuffer() {
      return new TextEncoder().encode(body).buffer
    },
  } as unknown as Response
}

function makeCollection<V>(entries: [string, V][]): {
  values: () => IterableIterator<V>
  [Symbol.iterator]: () => IterableIterator<[string, V]>
} {
  const map = new Map(entries)
  return {
    values: () => map.values(),
    [Symbol.iterator]: () => map.entries(),
  }
}

function makeMockMessage(overrides: {
  content?: string
  author?: { id: string; username: string; bot?: boolean }
  guild?: { id: string } | null
  channel?: { id: string; send?: (...args: unknown[]) => unknown }
  mentionedIds?: string[]
  mentionsEveryone?: boolean
  attachments?: Array<{ id: string; url: string; contentType?: string; name?: string }>
  stickers?: Array<{ id: string; name: string; url: string; format: number }>
  embeds?: Array<{
    title?: string
    description?: string
    url?: string
    toJSON?: () => unknown
  }>
}) {
  const channel = overrides.channel ?? { id: 'channel-1' }
  const message: any = {
    content: overrides.content ?? '',
    author: {
      id: 'user-1',
      username: 'alice',
      bot: false,
      ...overrides.author,
    },
    guild: overrides.guild === undefined ? null : overrides.guild,
    channel,
    mentions: {
      has: (id: string) => (overrides.mentionedIds ?? []).includes(id),
      everyone: overrides.mentionsEveryone ?? false,
    },
    attachments: makeCollection((overrides.attachments ?? []).map((a) => [a.id, a])),
    stickers: makeCollection((overrides.stickers ?? []).map((s) => [s.id, s])),
    embeds: (overrides.embeds ?? []).map((e) => ({
      title: e.title,
      description: e.description,
      url: e.url,
      toJSON: e.toJSON ?? (() => ({ ...e })),
    })),
    client: {
      user: { id: BOT_USER_ID },
    },
  }
  return message
}

const extractMedia = (channel: DiscordChannel, message: any) =>
  (channel as any).extractMedia(message) as Promise<{
    text: string | undefined
    images: any[]
    documents: any[]
    embeds: any[]
    embedTitle: string
    embedUrl: string
    embedDescription: string
  }>

const handleMessage = (channel: DiscordChannel, message: any) =>
  (channel as any).handleMessage(message) as Promise<void>

const truncateText = (channel: DiscordChannel, text: string) =>
  (channel as any).truncateText(text) as string

const enforceEmbedLimits = (channel: DiscordChannel, embeds: any[]) =>
  (channel as any).enforceEmbedLimits(embeds) as any[]

const readOutbound = (channel: DiscordChannel, obj: any) =>
  (channel as any).readOutbound(obj) as { embeds?: unknown; stickerIds?: unknown }

test.describe('DiscordChannel.extractMedia', () => {
  test('text only message', async () => {
    const result = await extractMedia(makeChannel(), makeMockMessage({ content: 'hi' }))
    assert.equal(result.text, 'hi')
    assert.equal(result.images.length, 0)
    assert.equal(result.documents.length, 0)
    assert.equal(result.embeds.length, 0)
  })

  test('image attachment is downloaded as base64', async () => {
    const result = await withFetch(
      async () => okResponse('img-bytes'),
      () =>
        extractMedia(
          makeChannel(),
          makeMockMessage({
            attachments: [
              { id: 'a1', url: 'https://cdn/a.png', contentType: 'image/png', name: 'a.png' },
            ],
          }),
        ),
    )
    assert.equal(result.images.length, 1)
    assert.equal(result.images[0].mimeType, 'image/png')
    assert.equal(result.images[0].name, 'a.png')
    assert.match(result.images[0].base64Url, /^data:image\/png;base64,/)
  })

  test('document attachment goes to documents', async () => {
    const result = await withFetch(
      async () => okResponse('pdf-bytes'),
      () =>
        extractMedia(
          makeChannel(),
          makeMockMessage({
            attachments: [
              {
                id: 'd1',
                url: 'https://cdn/d.pdf',
                contentType: 'application/pdf',
                name: 'report.pdf',
              },
            ],
          }),
        ),
    )
    assert.equal(result.images.length, 0)
    assert.equal(result.documents.length, 1)
    assert.equal(result.documents[0].name, 'report.pdf')
    assert.equal(result.documents[0].mimeType, 'application/pdf')
  })

  test('PNG sticker is treated as image with stickerName', async () => {
    const result = await withFetch(
      async () => okResponse('sticker-bytes'),
      () =>
        extractMedia(
          makeChannel(),
          makeMockMessage({
            stickers: [
              { id: 's1', name: 'wave', url: 'https://cdn/s1.png', format: StickerFormatType.PNG },
            ],
          }),
        ),
    )
    assert.equal(result.images.length, 1)
    assert.equal(result.images[0].name, 'sticker:wave')
    assert.equal(result.images[0].mimeType, 'image/png')
  })

  test('APNG sticker is treated as image', async () => {
    const result = await withFetch(
      async () => okResponse('sticker-bytes'),
      () =>
        extractMedia(
          makeChannel(),
          makeMockMessage({
            stickers: [
              { id: 's1', name: 'wave', url: 'https://cdn/s1', format: StickerFormatType.APNG },
            ],
          }),
        ),
    )
    assert.equal(result.images.length, 1)
  })

  test('Lottie sticker is skipped', async () => {
    const result = await extractMedia(
      makeChannel(),
      makeMockMessage({
        stickers: [
          { id: 's1', name: 'anim', url: 'https://cdn/s1', format: StickerFormatType.Lottie },
        ],
      }),
    )
    assert.equal(result.images.length, 0)
  })

  test('embeds populate object.embeds and metadata title/url/description', async () => {
    const result = await extractMedia(
      makeChannel(),
      makeMockMessage({
        embeds: [
          {
            title: 'Hello',
            description: 'A description',
            url: 'https://example.com',
            toJSON: () => ({
              title: 'Hello',
              description: 'A description',
              url: 'https://example.com',
            }),
          },
        ],
      }),
    )
    assert.equal(result.embeds.length, 1)
    assert.equal(result.embeds[0].title, 'Hello')
    assert.equal(result.embedTitle, 'Hello')
    assert.equal(result.embedUrl, 'https://example.com')
    assert.equal(result.embedDescription, 'A description')
  })

  test('embed description is truncated to 256 chars in metadata', async () => {
    const longDesc = 'x'.repeat(500)
    const result = await extractMedia(
      makeChannel(),
      makeMockMessage({
        embeds: [
          {
            title: 'T',
            description: longDesc,
            toJSON: () => ({ title: 'T', description: longDesc }),
          },
        ],
      }),
    )
    assert.equal(result.embedDescription.length, 256)
  })

  test('failed attachment download is skipped without throwing', async () => {
    const result = await withFetch(
      async () => ({ ok: false, status: 500, statusText: 'Server Error' }) as Response,
      () =>
        extractMedia(
          makeChannel(),
          makeMockMessage({
            attachments: [{ id: 'a1', url: 'https://cdn/a.png', contentType: 'image/png' }],
          }),
        ),
    )
    assert.equal(result.images.length, 0)
  })
})

test.describe('DiscordChannel.handleMessage transport', () => {
  test('self-message is ignored (anti-loop)', async () => {
    const channel = makeChannel()
    let called = false
    ;(channel as any).callback = async () => {
      called = true
    }
    ;(channel as any).botUserId = BOT_USER_ID
    await handleMessage(
      channel,
      makeMockMessage({
        content: 'mi propia respuesta',
        author: { id: BOT_USER_ID, username: 'self', bot: false },
      }),
    )
    assert.equal(called, false)
  })

  test('other bot messages are delivered (controller decides)', async () => {
    const channel = makeChannel()
    let called = false
    ;(channel as any).callback = async () => {
      called = true
    }
    ;(channel as any).botUserId = BOT_USER_ID
    await handleMessage(
      channel,
      makeMockMessage({
        content: 'hola desde otro bot',
        author: { id: 'other-bot', username: 'otherbot', bot: true },
      }),
    )
    assert.equal(called, true)
  })

  test('plain text in a guild is delivered (channel does not filter)', async () => {
    const channel = makeChannel()
    let called = false
    ;(channel as any).callback = async () => {
      called = true
    }
    ;(channel as any).botUserId = BOT_USER_ID
    await handleMessage(
      channel,
      makeMockMessage({
        content: 'texto sin mention en guild',
        guild: { id: 'g1' },
        mentionedIds: [],
      }),
    )
    assert.equal(called, true)
  })
})

test.describe('DiscordChannel.handleMessage context metadata', () => {
  test('populates metadata with the right fields on @mention', async () => {
    const channel = makeChannel()
    let captured: any = null
    ;(channel as any).callback = async (msg: any) => {
      captured = msg.message.metadata
    }
    ;(channel as any).botUserId = BOT_USER_ID
    await handleMessage(
      channel,
      makeMockMessage({
        content: '<@bot-user-id> hola',
        guild: { id: 'g1' },
        mentionedIds: [BOT_USER_ID],
      }),
    )
    assert.ok(captured)
    assert.equal(captured.botUserId, BOT_USER_ID)
    assert.equal(captured.wasBotMentioned, 'true')
    assert.equal(captured.wasEveryoneMentioned, 'false')
    assert.equal(captured.isDirectMessage, 'false')
  })

  test('metadata reflects @everyone in a guild', async () => {
    const channel = makeChannel()
    let captured: any = null
    ;(channel as any).callback = async (msg: any) => {
      captured = msg.message.metadata
    }
    ;(channel as any).botUserId = BOT_USER_ID
    await handleMessage(
      channel,
      makeMockMessage({
        content: '@everyone',
        guild: { id: 'g1' },
        mentionedIds: [],
        mentionsEveryone: true,
      }),
    )
    assert.equal(captured.wasEveryoneMentioned, 'true')
    assert.equal(captured.wasBotMentioned, 'false')
  })

  test('metadata flags DMs', async () => {
    const channel = makeChannel()
    let captured: any = null
    ;(channel as any).callback = async (msg: any) => {
      captured = msg.message.metadata
    }
    ;(channel as any).botUserId = BOT_USER_ID
    await handleMessage(channel, makeMockMessage({ content: 'hola', guild: null }))
    assert.equal(captured.isDirectMessage, 'true')
    assert.equal(captured.wasBotMentioned, 'false')
    assert.equal(captured.wasEveryoneMentioned, 'false')
  })

  test('metadata flags a plain guild message with no mention', async () => {
    const channel = makeChannel()
    let captured: any = null
    ;(channel as any).callback = async (msg: any) => {
      captured = msg.message.metadata
    }
    ;(channel as any).botUserId = BOT_USER_ID
    await handleMessage(
      channel,
      makeMockMessage({
        content: 'hola sin mention',
        guild: { id: 'g1' },
        mentionedIds: [],
      }),
    )
    assert.equal(captured.isDirectMessage, 'false')
    assert.equal(captured.wasBotMentioned, 'false')
    assert.equal(captured.wasEveryoneMentioned, 'false')
  })
})

test.describe('DiscordChannel.truncateText', () => {
  test('short text is returned as-is', () => {
    assert.equal(truncateText(makeChannel(), 'hello world'), 'hello world')
  })

  test('text at exactly 2000 chars is returned as-is', () => {
    const text = 'a'.repeat(2000)
    assert.equal(truncateText(makeChannel(), text), text)
  })

  test('text over 2000 chars is truncated with ellipsis', () => {
    const text = 'a'.repeat(3000)
    const out = truncateText(makeChannel(), text)
    assert.ok(out.length <= 2000)
    assert.ok(out.endsWith('…'))
  })

  test('prefers cutting at the last newline before 2000', () => {
    const line1 = 'a'.repeat(1500)
    const line2 = 'b'.repeat(800)
    const text = `${line1}\n${line2}`
    const out = truncateText(makeChannel(), text)
    assert.ok(out.startsWith(line1))
    assert.ok(out.endsWith('…'))
  })

  test('falls back to last space if no newline near the end', () => {
    const text = 'word '.repeat(800)
    const out = truncateText(makeChannel(), text)
    assert.ok(out.endsWith('…'))
    assert.ok(!out.endsWith(' …'))
  })
})

test.describe('DiscordChannel.enforceEmbedLimits', () => {
  test('truncates to 10 embeds', () => {
    const embeds = Array.from({ length: 15 }, (_, i) => ({
      title: `e${i}`,
    }))
    const out = enforceEmbedLimits(makeChannel(), embeds)
    assert.equal(out.length, 10)
  })

  test('truncates embed description to 4096', () => {
    const out = enforceEmbedLimits(makeChannel(), [{ description: 'x'.repeat(5000) }])
    assert.ok(out[0].description.length <= 4096)
  })

  test('truncates fields list to 25', () => {
    const out = enforceEmbedLimits(makeChannel(), [
      { fields: Array.from({ length: 30 }, (_, i) => ({ name: `n${i}`, value: 'v' })) },
    ])
    assert.equal(out[0].fields.length, 25)
  })

  test('truncates field value to 1024', () => {
    const out = enforceEmbedLimits(makeChannel(), [
      { fields: [{ name: 'k', value: 'v'.repeat(2000) }] },
    ])
    assert.ok(out[0].fields[0].value.length <= 1024)
  })

  test('truncates field name to 256', () => {
    const out = enforceEmbedLimits(makeChannel(), [
      { fields: [{ name: 'n'.repeat(500), value: 'v' }] },
    ])
    assert.ok(out[0].fields[0].name.length <= 256)
  })

  test('shaves description further if total embed exceeds 6000 chars', () => {
    const out = enforceEmbedLimits(makeChannel(), [
      {
        description: 'x'.repeat(4096),
        title: 't'.repeat(256),
        fields: Array.from({ length: 25 }, () => ({
          name: 'n'.repeat(256),
          value: 'v'.repeat(1024),
        })),
      },
    ])
    const total =
      (out[0].description?.length ?? 0) +
      (out[0].title?.length ?? 0) +
      out[0].fields.reduce(
        (s: number, f: any) => s + (f.name?.length ?? 0) + (f.value?.length ?? 0),
        0,
      )
    assert.ok(total <= 6000)
  })
})

test.describe('DiscordChannel.readOutbound', () => {
  test('returns empty when object is undefined', () => {
    const out = readOutbound(makeChannel(), undefined)
    assert.deepEqual(out, {})
  })

  test('returns empty when object has no discord fields', () => {
    const out = readOutbound(makeChannel(), { unrelated: 'x' })
    assert.deepEqual(out, {})
  })

  test('extracts embeds and stickerIds', () => {
    const out = readOutbound(makeChannel(), {
      embeds: [{ title: 'foo' }],
      stickerIds: ['1', '2'],
    })
    assert.deepEqual(out.embeds, [{ title: 'foo' }])
    assert.deepEqual(out.stickerIds, ['1', '2'])
  })

  test('ignores malformed values', () => {
    const out = readOutbound(makeChannel(), {
      embeds: 'not-an-array',
      stickerIds: { 0: '1' },
    })
    assert.equal(out.embeds, undefined)
    assert.equal(out.stickerIds, undefined)
  })
})

test.describe('DiscordChannel.sendReply', () => {
  function setupSend() {
    const sent: any[] = []
    const message = makeMockMessage({
      content: 'incoming',
      channel: {
        id: 'c1',
        send: async (opts: any) => {
          sent.push(opts)
          return { id: 'sent' }
        },
      },
    })
    return { sent, message }
  }

  test('truncates long text to 2000 chars', async () => {
    const { sent, message } = setupSend()
    const channel = makeChannel()
    ;(channel as any).callback = async () => {}
    await handleMessage(channel, message)
    await (channel as any).sendReply(message, { text: 'a'.repeat(3000) })
    assert.equal(sent.length, 1)
    assert.ok((sent[0].content?.length ?? 0) <= 2000)
  })

  test('sends embeds from object.outbound', async () => {
    const { sent, message } = setupSend()
    const channel = makeChannel()
    await (channel as any).sendReply(message, {
      text: 'ok',
      object: { embeds: [{ title: 't' }] },
    })
    assert.equal(sent.length, 1)
    assert.equal(sent[0].content, 'ok')
    assert.equal(sent[0].embeds.length, 1)
  })

  test('caps stickerIds to 3', async () => {
    const { sent, message } = setupSend()
    const channel = makeChannel()
    await (channel as any).sendReply(message, {
      object: { stickerIds: ['1', '2', '3', '4', '5'] },
    })
    assert.equal(sent[0].stickers.length, 3)
  })

  test('skips send when reply has no payload', async () => {
    const { sent, message } = setupSend()
    const channel = makeChannel()
    await (channel as any).sendReply(message, {})
    assert.equal(sent.length, 0)
  })
})
