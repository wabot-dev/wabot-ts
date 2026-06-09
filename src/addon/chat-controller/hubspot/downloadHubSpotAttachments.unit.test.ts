import test from 'node:test'
import assert from 'node:assert/strict'

import { downloadHubSpotAttachments } from './downloadHubSpotAttachments'
import { IHubSpotAttachment } from './IHubSpotWebhookEvent'

type FetchCall = { url: string; init?: RequestInit }

function stubFetch(
  responses: Array<{ ok: boolean; status?: number; body?: ArrayBuffer; statusText?: string }>,
): { calls: FetchCall[]; restore: () => void } {
  const calls: FetchCall[] = []
  const originalFetch = globalThis.fetch
  let i = 0
  ;(globalThis as any).fetch = async (url: string, init?: RequestInit) => {
    calls.push({ url, init })
    const spec = responses[i++] ?? { ok: false, status: 500, statusText: 'no stub' }
    return {
      ok: spec.ok,
      status: spec.status ?? (spec.ok ? 200 : 500),
      statusText: spec.statusText ?? '',
      async arrayBuffer() {
        return spec.body ?? new ArrayBuffer(0)
      },
    } as unknown as Response
  }
  return {
    calls,
    restore: () => {
      ;(globalThis as any).fetch = originalFetch
    },
  }
}

function bufferToArrayBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
}

test.describe('downloadHubSpotAttachments', () => {
  test('returns [] for missing or empty attachments', async () => {
    const fetchStub = stubFetch([])
    try {
      const r1 = await downloadHubSpotAttachments(undefined, { accessToken: 't' })
      const r2 = await downloadHubSpotAttachments([], { accessToken: 't' })
      assert.deepEqual(r1, [])
      assert.deepEqual(r2, [])
      assert.equal(fetchStub.calls.length, 0)
    } finally {
      fetchStub.restore()
    }
  })

  test('downloads an attachment and encodes its bytes as a base64 data-URI', async () => {
    const body = bufferToArrayBuffer(Buffer.from('hello'))
    const fetchStub = stubFetch([{ ok: true, body }])
    try {
      const attachment: IHubSpotAttachment = {
        id: 'att-1',
        name: 'a.png',
        mimeType: 'image/png',
        url: 'https://files.hubspot.com/a.png',
        fileId: 'f-1',
      }
      const files = await downloadHubSpotAttachments([attachment], { accessToken: 'tok' })

      assert.equal(files.length, 1)
      assert.equal(files[0].id, 'f-1')
      assert.equal(files[0].name, 'a.png')
      assert.equal(files[0].mimeType, 'image/png')
      assert.equal(
        files[0].base64Url,
        `data:image/png;base64,${Buffer.from('hello').toString('base64')}`,
      )

      assert.equal(fetchStub.calls[0].url, 'https://files.hubspot.com/a.png')
      const headers = (fetchStub.calls[0].init?.headers as Record<string, string>) ?? {}
      assert.equal(headers.Authorization, 'Bearer tok')
    } finally {
      fetchStub.restore()
    }
  })

  test('skips attachments without a url and logs a warning', async () => {
    const fetchStub = stubFetch([])
    const warnings: string[] = []
    const logger = { warn: (m: string) => warnings.push(m) } as any
    try {
      const files = await downloadHubSpotAttachments(
        [{ id: 'att-2' }],
        { accessToken: 'tok', logger },
      )
      assert.deepEqual(files, [])
      assert.equal(fetchStub.calls.length, 0)
      assert.match(warnings[0], /no url/)
    } finally {
      fetchStub.restore()
    }
  })

  test('skips attachments that fail to download and continues with the rest', async () => {
    const body = bufferToArrayBuffer(Buffer.from('ok-bytes'))
    const fetchStub = stubFetch([
      { ok: false, status: 404, statusText: 'Not Found' },
      { ok: true, body },
    ])
    const warnings: string[] = []
    const logger = { warn: (m: string) => warnings.push(m) } as any
    try {
      const files = await downloadHubSpotAttachments(
        [
          { id: 'bad', url: 'https://files.hubspot.com/missing' },
          { id: 'good', mimeType: 'image/jpeg', url: 'https://files.hubspot.com/ok.jpg' },
        ],
        { accessToken: 'tok', logger },
      )

      assert.equal(files.length, 1)
      assert.equal(files[0].id, 'good')
      assert.match(warnings[0], /failed to download HubSpot attachment 'bad'/)
    } finally {
      fetchStub.restore()
    }
  })

  test('falls back to application/octet-stream when mimeType is missing', async () => {
    const body = bufferToArrayBuffer(Buffer.from('x'))
    const fetchStub = stubFetch([{ ok: true, body }])
    try {
      const files = await downloadHubSpotAttachments(
        [{ id: 'att', url: 'https://files.hubspot.com/x' }],
        { accessToken: 'tok' },
      )
      assert.equal(files[0].mimeType, 'application/octet-stream')
      assert.match(files[0].base64Url!, /^data:application\/octet-stream;base64,/)
    } finally {
      fetchStub.restore()
    }
  })
})
