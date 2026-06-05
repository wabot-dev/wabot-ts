import test from 'node:test'
import assert from 'node:assert/strict'
import { extractChatMessageText } from './extractChatMessageText'

test.describe('extractChatMessageText', () => {
  test('includes the image description when present', () => {
    const text = extractChatMessageText({
      text: 'look',
      images: [
        {
          id: 'i1',
          mimeType: 'image/png',
          base64Url: 'data:image/png;base64,AAAA',
          description: 'a cat on a sofa',
        },
      ],
    })

    const parsed = JSON.parse(text)
    assert.equal(parsed.images[0].id, 'i1')
    assert.equal(parsed.images[0].description, 'a cat on a sofa')
  })

  test('omits the description key when absent', () => {
    const text = extractChatMessageText({
      images: [{ id: 'i1', mimeType: 'image/png', base64Url: 'data:image/png;base64,AAAA' }],
    })

    const parsed = JSON.parse(text)
    assert.ok(!('description' in parsed.images[0]))
  })
})
