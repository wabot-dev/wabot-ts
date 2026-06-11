import test from 'node:test'
import assert from 'node:assert/strict'
import { HubSpotSender } from './HubSpotSender'
import { HubSpotChannelConfig } from './HubSpotChannelConfig'
import { IChatMessageFile } from '@/feature/chat-bot'

type ApiRequestCall = {
  method?: string
  path?: string
  body?: string | FormData
  headers?: Record<string, string>
}

type FetchCall = {
  url: string
  init: RequestInit
}

interface IFakeResponse {
  ok: boolean
  status: number
  json: () => Promise<unknown>
  text: () => Promise<string>
}

interface IFakeClient {
  apiRequest: (opts: ApiRequestCall) => Promise<IFakeResponse>
  apiRequestCalls: ApiRequestCall[]
  fetchCalls: FetchCall[]
  uploadResponses: { id: string }[]
  messageResponse: { id: string }
  apiStatus?: number
  apiBody?: string
}

function makeFakeClient(opts: {
  uploadResponses?: { id: string }[]
  messageResponse?: { id: string }
  apiStatus?: number
  apiBody?: string
} = {}): IFakeClient {
  const apiRequestCalls: ApiRequestCall[] = []
  const fetchCalls: FetchCall[] = []
  const uploadResponses = opts.uploadResponses ?? [{ id: 'f_1' }]
  let uploadIdx = 0
  const realFetch = global.fetch
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(global as any).fetch = async (url: string, init: RequestInit) => {
    fetchCalls.push({ url, init })
    const isUpload = url.toString().includes('/files/v3/files')
    const responseBody = isUpload
      ? (uploadResponses[uploadIdx++] ?? { id: 'f_x' })
      : (opts.messageResponse ?? { id: 'msg_1' })
    const status = opts.apiStatus ?? 201
    return {
      ok: status >= 200 && status < 300,
      status,
      async json() {
        return responseBody
      },
      async text() {
        return JSON.stringify(responseBody)
      },
    } as IFakeResponse
  }
  return {
    apiRequestCalls,
    fetchCalls,
    uploadResponses,
    messageResponse: opts.messageResponse ?? { id: 'msg_1' },
    apiStatus: opts.apiStatus,
    apiBody: opts.apiBody,
    async apiRequest(req) {
      apiRequestCalls.push(req)
      const status = opts.apiStatus ?? 201
      const ok = status >= 200 && status < 300
      const isUpload = (req.path ?? '').startsWith('/files/v3/files')
      const responseBody = isUpload
        ? (uploadResponses[uploadIdx++] ?? { id: 'f_x' })
        : opts.messageResponse
      return {
        ok,
        status,
        async json() {
          return responseBody
        },
        async text() {
          return JSON.stringify(responseBody)
        },
      }
    },
  } as IFakeClient
}

function makeConfig(): HubSpotChannelConfig {
  return new HubSpotChannelConfig({
    accessToken: 'fake-token',
    webhookSecret: 'fake-secret',
    webhookPath: '/hubspot/webhook',
  })
}

test.describe('HubSpotSender.sendMessage', () => {
  test('sends a text-only message via the Conversations API', async () => {
    const fake = makeFakeClient({ messageResponse: { id: 'msg_42' } })
    const sender = new HubSpotSender(makeConfig(), fake as any)

    const result = await sender.sendMessage({ threadId: 'thr-1', text: 'hola' })

    assert.equal(result.messageId, 'msg_42')
    assert.equal(fake.apiRequestCalls.length, 1)
    const call = fake.apiRequestCalls[0]
    assert.equal(call.method, 'POST')
    assert.equal(call.path, '/conversations/v3/conversations/threads/thr-1/messages')
    assert.equal(call.headers?.['Content-Type'], 'application/json')
    const body = JSON.parse(call.body as string)
    assert.deepEqual(body, { type: 'MESSAGE', text: 'hola' })
  })

  test('uploads files first and attaches their ids to the message', async () => {
    const fake = makeFakeClient({
      uploadResponses: [{ id: 'f_a' }, { id: 'f_b' }],
      messageResponse: { id: 'msg_99' },
    })
    const sender = new HubSpotSender(makeConfig(), fake as any)

    const file: IChatMessageFile = {
      id: 'img-1',
      name: 'a.png',
      mimeType: 'image/png',
      base64Url: 'data:image/png;base64,aGVsbG8=',
    }
    await sender.sendMessage({ threadId: 'thr-2', text: 'con adjunto', files: [file] })

    assert.equal(fake.fetchCalls.length, 1)
    const upload = fake.fetchCalls[0]
    assert.equal(upload.url, 'https://api.hubapi.com/files/v3/files')
    assert.equal((upload.init.headers as Record<string, string>).Authorization, 'Bearer fake-token')
    assert.ok(upload.init.body instanceof FormData)
    const uploadedFile = (upload.init.body as FormData).get('file') as File
    assert.equal(uploadedFile.name, 'a.png')
    assert.equal((upload.init.body as FormData).get('folderPath'), '/')
    const options = (upload.init.body as FormData).get('options') as string
    assert.ok(options.includes('"access":"PUBLIC_INDEXABLE"'))

    assert.equal(fake.apiRequestCalls.length, 1)
    const send = fake.apiRequestCalls[0]
    const body = JSON.parse(send.body as string)
    assert.deepEqual(body.attachments, [{ fileId: 'f_a' }])
  })

  test('encodes the threadId in the path', async () => {
    const fake = makeFakeClient({ messageResponse: { id: 'msg_x' } })
    const sender = new HubSpotSender(makeConfig(), fake as any)

    await sender.sendMessage({ threadId: 'thr/with/slash', text: 'ok' })

    assert.equal(
      fake.apiRequestCalls[0].path,
      '/conversations/v3/conversations/threads/thr%2Fwith%2Fslash/messages',
    )
  })

  test('throws when the API responds with a non-2xx status', async () => {
    const fake = makeFakeClient({ apiStatus: 400, apiBody: '{"message":"bad thread"}' })
    const sender = new HubSpotSender(makeConfig(), fake as any)

    await assert.rejects(
      () => sender.sendMessage({ threadId: 'thr-1', text: 'x' }),
      /HubSpot sendMessage failed: 400/,
    )
  })

  test('forwards richText alongside the text in the body', async () => {
    const fake = makeFakeClient({ messageResponse: { id: 'msg_77' } })
    const sender = new HubSpotSender(makeConfig(), fake as any)

    await sender.sendMessage({
      threadId: 'thr-3',
      text: '**bold**',
      richText: '<b>bold</b>',
    })

    const body = JSON.parse(fake.apiRequestCalls[0].body as string)
    assert.equal(body.text, '**bold**')
    assert.equal(body.richText, '<b>bold</b>')
  })

  test('allows sending richText without plain text', async () => {
    const fake = makeFakeClient({ messageResponse: { id: 'msg_78' } })
    const sender = new HubSpotSender(makeConfig(), fake as any)

    await sender.sendMessage({ threadId: 'thr-4', richText: '<i>solo html</i>' })

    const body = JSON.parse(fake.apiRequestCalls[0].body as string)
    assert.equal(body.text, undefined)
    assert.equal(body.richText, '<i>solo html</i>')
  })

  test('throws when there is no text, no richText and no files', async () => {
    const fake = makeFakeClient({ messageResponse: { id: 'msg_1' } })
    const sender = new HubSpotSender(makeConfig(), fake as any)

    await assert.rejects(
      () => sender.sendMessage({ threadId: 'thr-1' }),
      /requires at least text, richText or files/,
    )
    assert.equal(fake.apiRequestCalls.length, 0)
  })

  test('throws when the response has no id', async () => {
    const fake = makeFakeClient({ messageResponse: {} as { id: string } })
    const sender = new HubSpotSender(makeConfig(), fake as any)

    await assert.rejects(
      () => sender.sendMessage({ threadId: 'thr-1', text: 'x' }),
      /did not include an id/,
    )
  })

  test('forwards senderActorId, channelId and channelAccountId into the body', async () => {
    const fake = makeFakeClient({ messageResponse: { id: 'msg_99' } })
    const sender = new HubSpotSender(makeConfig(), fake as any)

    await sender.sendMessage({
      threadId: 'thr-9',
      text: 'con contexto',
      senderActorId: 'A-123',
      channelId: '1000',
      channelAccountId: '424242',
    })

    const body = JSON.parse(fake.apiRequestCalls[0].body as string)
    assert.equal(body.senderActorId, 'A-123')
    assert.equal(body.channelId, '1000')
    assert.equal(body.channelAccountId, '424242')
  })

  test('uses config.senderActorId when request omits it', async () => {
    const fake = makeFakeClient({ messageResponse: { id: 'msg_99' } })
    const config = new HubSpotChannelConfig({
      accessToken: 'fake-token',
      webhookSecret: 'fake-secret',
      webhookPath: '/hubspot/webhook',
      senderActorId: 'A-config',
    })
    const sender = new HubSpotSender(config, fake as any)

    await sender.sendMessage({
      threadId: 'thr-9',
      text: 'hola',
      channelId: '1000',
      channelAccountId: '424242',
    })

    const body = JSON.parse(fake.apiRequestCalls[0].body as string)
    assert.equal(body.senderActorId, 'A-config')
  })
})
