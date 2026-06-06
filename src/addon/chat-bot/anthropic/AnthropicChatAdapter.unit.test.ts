import test from 'node:test'
import assert from 'node:assert/strict'
import { Env } from '@/core/env'
import { IChatItem } from '@/feature/chat-bot'
import { AnthropicChatAdapter } from './AnthropicChatAdapter'

process.env.ANTHROPIC_API_KEY ??= 'test-key'

const image = () => ({ id: 'img1', mimeType: 'image/png', base64Url: 'data:image/png;base64,AAAA' })
const humanWithImage = (text: string): IChatItem => ({
  type: 'humanMessage',
  humanMessage: { text, images: [image()] },
})
const bot = (text: string): IChatItem => ({ type: 'botMessage', botMessage: { text } })

function mapChatItems(items: IChatItem[]): any[] {
  const adapter = new AnthropicChatAdapter(new Env())
  return (adapter as any).mapChatItems(items)
}

function imageBlocks(message: any): number {
  return Array.isArray(message.content)
    ? message.content.filter((b: any) => b.type === 'image').length
    : 0
}

function textBlocks(message: any): number {
  return Array.isArray(message.content)
    ? message.content.filter((b: any) => b.type === 'text').length
    : 0
}

test.describe('AnthropicChatAdapter media mapping', () => {
  test('maps a present image to an image block', () => {
    const [userMsg] = mapChatItems([humanWithImage('what is this?')])
    assert.equal(imageBlocks(userMsg), 1)
    assert.equal(textBlocks(userMsg), 1)
  })

  test('maps the media it is given, regardless of conversation position', () => {
    // The adapter is a pure translator: choosing which media to send is the
    // bot's job (see stripAnsweredMedia), so whatever reaches the adapter is
    // mapped as-is.
    const messages = mapChatItems([
      humanWithImage('first image'),
      bot('described first'),
      humanWithImage('second image'),
    ])
    assert.equal(imageBlocks(messages[0]), 1)
    assert.equal(imageBlocks(messages[2]), 1)
  })

  test('skips an unsupported image mime type but keeps the text', () => {
    const [userMsg] = mapChatItems([
      {
        type: 'humanMessage',
        humanMessage: {
          text: 'look',
          images: [{ id: 'i1', mimeType: 'image/bmp', publicUrl: 'https://example.com/i.bmp' }],
        },
      },
    ])
    assert.equal(imageBlocks(userMsg), 0, 'unsupported mime is not sent as an image block')
    assert.equal(textBlocks(userMsg), 1)
  })
})
