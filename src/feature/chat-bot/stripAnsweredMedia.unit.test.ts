import test from 'node:test'
import assert from 'node:assert/strict'
import { stripAnsweredMedia } from './stripAnsweredMedia'
import { IChatItem } from './IChatItem'

const image = () => ({ id: 'img1', mimeType: 'image/png', base64Url: 'data:image/png;base64,AAAA' })
const humanWithImage = (text: string): IChatItem => ({
  type: 'humanMessage',
  humanMessage: { text, images: [image()] },
})
const human = (text: string): IChatItem => ({ type: 'humanMessage', humanMessage: { text } })
const bot = (text: string): IChatItem => ({ type: 'botMessage', botMessage: { text } })
const call = (): IChatItem => ({
  type: 'functionCall',
  functionCall: { id: 'c1', name: 'tool', arguments: '{}', result: 'ok' },
})

function imageCount(item: IChatItem): number {
  return item.type === 'humanMessage' ? (item.humanMessage.images?.length ?? 0) : 0
}

test.describe('stripAnsweredMedia', () => {
  test('keeps media for a pending (not-yet-answered) human message', () => {
    const [item] = stripAnsweredMedia([humanWithImage('what is this?')])
    assert.equal(imageCount(item), 1)
  })

  test('strips media once the message has been answered by the bot', () => {
    const [first] = stripAnsweredMedia([
      humanWithImage('what is this?'),
      bot('a cat'),
      human('what color?'),
    ])
    assert.equal(imageCount(first), 0)
  })

  test('keeps the latest turn media while stripping older answered ones', () => {
    const result = stripAnsweredMedia([
      humanWithImage('first image'),
      bot('described first'),
      humanWithImage('second image'),
    ])
    assert.equal(imageCount(result[0]), 0, 'older answered image stripped')
    assert.equal(imageCount(result[2]), 1, 'current image kept')
  })

  test('keeps media through a tool loop until the bot replies', () => {
    const [first] = stripAnsweredMedia([humanWithImage('analyze this'), call()])
    assert.equal(imageCount(first), 1, 'pending image survives the tool call')
  })

  test('preserves non-media fields when stripping', () => {
    const [first] = stripAnsweredMedia([
      { type: 'humanMessage', humanMessage: { text: 'hi', senderId: 'u1', images: [image()] } },
      bot('reply'),
      human('again'),
    ])
    assert.equal(first.humanMessage?.text, 'hi')
    assert.equal(first.humanMessage?.senderId, 'u1')
    assert.equal(imageCount(first), 0)
  })

  test('leaves bot and function-call items untouched', () => {
    const items = [humanWithImage('x'), call(), bot('y')]
    const result = stripAnsweredMedia(items)
    assert.equal(result[1], items[1], 'function call kept by reference')
    assert.equal(result[2], items[2], 'bot message kept by reference')
  })
})
