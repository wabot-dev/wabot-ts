import test from 'node:test'
import assert from 'node:assert/strict'
import { HubSpotSender } from './HubSpotSender'
import { HubSpotChannelConfig } from './HubSpotChannelConfig'
import { IChatMessageFile } from '@/feature/chat-bot'

type ApiRequestCall = { method?: string; path?: string; body?: string; headers?: Record<string, string> }
type UploadCall = { data: Buffer; name: string }

interface IFakeClient {
  files: { filesApi: { upload: (file: { data: Buffer; name: string }) => Promise<{ id: string }> } }
  apiRequest: (opts: ApiRequestCall) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown>; text: () => Promise<string> }>
  apiRequestCalls: ApiRequestCall[]
  uploadCalls: UploadCall[]
}

function makeFakeClient(opts: {
  uploadedFileIds?: string[]
  apiResponse?: { id: string }
  apiStatus?: number
  apiBody?: string
}): IFakeClient {
  const apiRequestCalls: ApiRequestCall[] = []
  const uploadCalls: UploadCall[] = []
  const uploadedFileIds = opts.uploadedFileIds ?? []
  return {
    files: {
      filesApi: {
        async upload(file) {
          uploadCalls.push({ data: file.data, name: file.name })
          return { id: uploadedFileIds[uploadCalls.length - 1] ?? `f_${uploadCalls.length}` }
        },
      },
    },
    async apiRequest(req) {
      apiRequestCalls.push(req)
      const status = opts.apiStatus ?? 201
      const ok = status >= 200 && status < 300
      return {
        ok,
        status,
        async json() {
          return opts.apiResponse ?? { id: 'msg_1' }
        },
        async text() {
          return opts.apiBody ?? JSON.stringify(opts.apiResponse ?? { id: 'msg_1' })
        },
      }
    },
    apiRequestCalls,
    uploadCalls,
  }
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
    const fake = makeFakeClient({ apiResponse: { id: 'msg_42' } })
    const sender = new HubSpotSender(makeConfig(), fake as any)

    const result = await sender.sendMessage({ threadId: 'thr-1', text: 'hola' })

    assert.equal(result.messageId, 'msg_42')
    assert.equal(fake.uploadCalls.length, 0)
    assert.equal(fake.apiRequestCalls.length, 1)
    const call = fake.apiRequestCalls[0]
    assert.equal(call.method, 'POST')
    assert.equal(call.path, '/conversations/v3/conversations/thr-1/messages')
    assert.equal(call.headers?.['Content-Type'], 'application/json')
    const body = JSON.parse(call.body!)
    assert.deepEqual(body, { type: 'MESSAGE', text: 'hola' })
  })

  test('uploads files first and attaches their ids to the message', async () => {
    const fake = makeFakeClient({
      uploadedFileIds: ['f_a', 'f_b'],
      apiResponse: { id: 'msg_99' },
    })
    const sender = new HubSpotSender(makeConfig(), fake as any)

    const file: IChatMessageFile = {
      id: 'img-1',
      name: 'a.png',
      mimeType: 'image/png',
      base64Url: 'data:image/png;base64,aGVsbG8=',
    }
    await sender.sendMessage({ threadId: 'thr-2', text: 'con adjunto', files: [file] })

    assert.equal(fake.uploadCalls.length, 1)
    assert.equal(fake.uploadCalls[0].name, 'a.png')
    assert.equal(fake.uploadCalls[0].data.toString('utf8'), 'hello')

    const body = JSON.parse(fake.apiRequestCalls[0].body!)
    assert.deepEqual(body.attachments, [{ fileId: 'f_a' }])
  })

  test('encodes the threadId in the path', async () => {
    const fake = makeFakeClient({ apiResponse: { id: 'msg_x' } })
    const sender = new HubSpotSender(makeConfig(), fake as any)

    await sender.sendMessage({ threadId: 'thr/with/slash', text: 'ok' })

    assert.equal(fake.apiRequestCalls[0].path, '/conversations/v3/conversations/thr%2Fwith%2Fslash/messages')
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
    const fake = makeFakeClient({ apiResponse: { id: 'msg_77' } })
    const sender = new HubSpotSender(makeConfig(), fake as any)

    await sender.sendMessage({
      threadId: 'thr-3',
      text: '**bold**',
      richText: '<b>bold</b>',
    })

    const body = JSON.parse(fake.apiRequestCalls[0].body!)
    assert.equal(body.text, '**bold**')
    assert.equal(body.richText, '<b>bold</b>')
  })

  test('allows sending richText without plain text', async () => {
    const fake = makeFakeClient({ apiResponse: { id: 'msg_78' } })
    const sender = new HubSpotSender(makeConfig(), fake as any)

    await sender.sendMessage({ threadId: 'thr-4', richText: '<i>solo html</i>' })

    const body = JSON.parse(fake.apiRequestCalls[0].body!)
    assert.equal(body.text, undefined)
    assert.equal(body.richText, '<i>solo html</i>')
  })

  test('throws when there is no text, no richText and no files', async () => {
    const fake = makeFakeClient({ apiResponse: { id: 'msg_1' } })
    const sender = new HubSpotSender(makeConfig(), fake as any)

    await assert.rejects(
      () => sender.sendMessage({ threadId: 'thr-1' }),
      /requires at least text, richText or files/,
    )
    assert.equal(fake.apiRequestCalls.length, 0)
  })

  test('throws when the response has no id', async () => {
    const fake = makeFakeClient({ apiResponse: {} as { id: string } })
    const sender = new HubSpotSender(makeConfig(), fake as any)

    await assert.rejects(
      () => sender.sendMessage({ threadId: 'thr-1', text: 'x' }),
      /did not include an id/,
    )
  })
})
