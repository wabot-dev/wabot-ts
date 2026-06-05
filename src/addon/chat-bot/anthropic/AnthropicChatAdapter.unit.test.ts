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

test.describe('AnthropicChatAdapter media gating', () => {
  test('sends the image for a pending (not-yet-answered) human message', () => {
    const [userMsg] = mapChatItems([humanWithImage('what is this?')])
    assert.equal(imageBlocks(userMsg), 1)
  })

  test('drops the image once the message has been answered by the bot', () => {
    const messages = mapChatItems([
      humanWithImage('what is this?'),
      bot('a cat'),
      { type: 'humanMessage', humanMessage: { text: 'what color?' } },
    ])

    // [0] = answered human message with the image, [1] = bot, [2] = new human message
    assert.equal(imageBlocks(messages[0]), 0, 'historical image must not be re-sent')
    assert.equal(textBlocks(messages[0]), 1, 'text (with image metadata) is preserved')
  })

  test('keeps the image of the latest turn while dropping older answered ones', () => {
    const messages = mapChatItems([
      humanWithImage('first image'),
      bot('described first'),
      humanWithImage('second image'),
    ])

    assert.equal(imageBlocks(messages[0]), 0, 'older answered image dropped')
    assert.equal(imageBlocks(messages[2]), 1, 'current image still sent')
  })

  test('keeps the image across the active tool-calling loop (no bot reply yet)', () => {
    const messages = mapChatItems([
      humanWithImage('analyze this'),
      {
        type: 'functionCall',
        functionCall: { id: 'c1', name: 'tool', arguments: '{}', result: 'ok' },
      },
    ])
    assert.equal(imageBlocks(messages[0]), 1, 'image stays available until the turn is answered')
  })
})
