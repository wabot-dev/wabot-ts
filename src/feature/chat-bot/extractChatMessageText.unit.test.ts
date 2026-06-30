import test from 'node:test'
import assert from 'node:assert/strict'
import { extractChatMessageText } from './extractChatMessageText'

test.describe('extractChatMessageText', () => {
  test('includes image identity without the binary', () => {
    const text = extractChatMessageText({
      text: 'look',
      images: [
        {
          id: 'i1',
          name: 'cat.png',
          mimeType: 'image/png',
          base64Url: 'data:image/png;base64,AAAA',
        },
      ],
    })

    const parsed = JSON.parse(text)
    assert.equal(parsed.images[0].id, 'i1')
    assert.equal(parsed.images[0].name, 'cat.png')
    assert.ok(!('base64Url' in parsed.images[0]))
  })

  test('marks unsupported image mime types as not analyzed', () => {
    const text = extractChatMessageText(
      {
        images: [{ id: 'i1', mimeType: 'image/heic', base64Url: 'data:image/heic;base64,AAAA' }],
      },
      { supportedImageMimeTypes: ['image/png'] },
    )

    const parsed = JSON.parse(text)
    assert.equal(parsed.images[0].notAnalyzed, true)
  })
})
