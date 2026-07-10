import test from 'node:test'
import assert from 'node:assert/strict'
import type { Api } from 'grammy'
import type { Message } from 'grammy/types'
import { TelegramChannel } from './TelegramChannel'
import { TelegramChannelConfig } from './TelegramChannelConfig'

const BOT_TOKEN = '123:fake-token'

function makeChannel() {
  return new TelegramChannel(new TelegramChannelConfig(BOT_TOKEN))
}

/** Stubs `api.getFile` to echo a file_path and records the file_ids it was asked for. */
function makeApi(requestedFileIds: string[]): Api {
  return {
    async getFile(fileId: string) {
      requestedFileIds.push(fileId)
      return { file_id: fileId, file_unique_id: `u_${fileId}`, file_path: `path/${fileId}.bin` }
    },
  } as unknown as Api
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

const extractMedia = (channel: TelegramChannel, api: Api, message: Partial<Message>) =>
  (channel as any).extractMedia(api, message) as Promise<{
    images: any[]
    documents: any[]
    audios: any[]
  }>

test.describe('TelegramChannel.extractMedia', () => {
  test('downloads the highest-resolution photo as a base64 image', async () => {
    const requested: string[] = []
    const result = await withFetch(
      async () => okResponse('hello'),
      () =>
        extractMedia(makeChannel(), makeApi(requested), {
          photo: [
            { file_id: 'small', file_unique_id: 'us', width: 90, height: 90 },
            { file_id: 'big', file_unique_id: 'ub', width: 1280, height: 1280 },
          ],
        }),
    )

    assert.deepEqual(requested, ['big'])
    assert.equal(result.documents.length, 0)
    assert.equal(result.images.length, 1)
    assert.deepEqual(result.images[0], {
      id: 'ub',
      name: undefined,
      mimeType: 'image/jpeg',
      base64Url: 'data:image/jpeg;base64,aGVsbG8=',
    })
  })

  test('builds the download URL from token and file_path', async () => {
    const urls: string[] = []
    await withFetch(
      async (input) => {
        urls.push(String(input))
        return okResponse('x')
      },
      () =>
        extractMedia(makeChannel(), makeApi([]), {
          photo: [{ file_id: 'big', file_unique_id: 'ub', width: 10, height: 10 }],
        }),
    )

    assert.deepEqual(urls, [`https://api.telegram.org/file/bot${BOT_TOKEN}/path/big.bin`])
  })

  test('maps a document to documents, preserving name and mime type', async () => {
    const result = await withFetch(
      async () => okResponse('pdf-bytes'),
      () =>
        extractMedia(makeChannel(), makeApi([]), {
          document: {
            file_id: 'doc1',
            file_unique_id: 'ud',
            file_name: 'report.pdf',
            mime_type: 'application/pdf',
          },
        }),
    )

    assert.equal(result.images.length, 0)
    assert.equal(result.documents.length, 1)
    assert.equal(result.documents[0].name, 'report.pdf')
    assert.equal(result.documents[0].mimeType, 'application/pdf')
    assert.match(result.documents[0].base64Url, /^data:application\/pdf;base64,/)
  })

  test('routes an image sent as a document into images', async () => {
    const result = await withFetch(
      async () => okResponse('png-bytes'),
      () =>
        extractMedia(makeChannel(), makeApi([]), {
          document: {
            file_id: 'doc2',
            file_unique_id: 'ud2',
            file_name: 'photo.png',
            mime_type: 'image/png',
          },
        }),
    )

    assert.equal(result.documents.length, 0)
    assert.equal(result.images.length, 1)
    assert.equal(result.images[0].mimeType, 'image/png')
  })

  test('falls back to a generic mime type for documents without one', async () => {
    const result = await withFetch(
      async () => okResponse('bytes'),
      () =>
        extractMedia(makeChannel(), makeApi([]), {
          document: { file_id: 'doc3', file_unique_id: 'ud3' },
        }),
    )

    assert.equal(result.documents[0].mimeType, 'application/octet-stream')
  })

  test('skips a file when the download fails, without throwing', async () => {
    const result = await withFetch(
      async () => ({ ok: false, status: 500, statusText: 'Server Error' }) as Response,
      () =>
        extractMedia(makeChannel(), makeApi([]), {
          photo: [{ file_id: 'big', file_unique_id: 'ub', width: 10, height: 10 }],
        }),
    )

    assert.equal(result.images.length, 0)
    assert.equal(result.documents.length, 0)
  })

  test('returns empty arrays when there is no media', async () => {
    const result = await extractMedia(makeChannel(), makeApi([]), { text: 'just text' })
    assert.deepEqual(result, { images: [], documents: [], audios: [] })
  })
})
