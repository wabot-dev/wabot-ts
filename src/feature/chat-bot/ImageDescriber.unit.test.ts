import test from 'node:test'
import assert from 'node:assert/strict'
import { ImageDescriber } from './ImageDescriber'
import { ChatAdapter } from './ChatAdapter'
import { IChatAdapterNextItemsReq, IChatAdapterNextItemsRes } from './IChatAdapter'
import { IChatMessage } from './IChatMessage'
import { IChatMessageImage } from './IChatMessageImage'

const models = [{ provider: 'x', model: 'm' }]

const image = (over: { id?: string; description?: string } = {}): IChatMessageImage => ({
  id: 'i1',
  mimeType: 'image/png',
  base64Url: 'data:image/png;base64,AAAA',
  ...over,
})

const botRes = (text: string): IChatAdapterNextItemsRes => ({
  usage: { inputTokens: 1, outputTokens: 1, provider: 'x', model: 'm' },
  nextItems: [{ type: 'botMessage', botMessage: { text } }],
})

function fakeAdapter(
  impl: (req: IChatAdapterNextItemsReq) => IChatAdapterNextItemsRes,
  calls?: IChatAdapterNextItemsReq[],
): ChatAdapter {
  return {
    async nextItems(req: IChatAdapterNextItemsReq) {
      calls?.push(req)
      return impl(req)
    },
  } as unknown as ChatAdapter
}

test.describe('ImageDescriber.describe', () => {
  test('returns the model description text', async () => {
    const describer = new ImageDescriber(fakeAdapter(() => botRes('a red square')))
    assert.equal(await describer.describe(image(), models), 'a red square')
  })

  test('sends the image and a description prompt to the model', async () => {
    const calls: IChatAdapterNextItemsReq[] = []
    const describer = new ImageDescriber(fakeAdapter(() => botRes('desc'), calls))
    await describer.describe(image({ id: 'abc' }), models)

    assert.equal(calls.length, 1)
    assert.ok(calls[0].systemPrompt.length > 0)
    assert.equal(calls[0].prevItems.length, 1)
    assert.equal(calls[0].prevItems[0].humanMessage?.images?.[0].id, 'abc')
  })

  test('skips the model call when there are no vision models', async () => {
    let called = false
    const describer = new ImageDescriber(
      fakeAdapter(() => {
        called = true
        return botRes('x')
      }),
    )
    assert.equal(await describer.describe(image(), []), undefined)
    assert.equal(called, false)
  })

  test('returns undefined when the model call fails', async () => {
    const describer = new ImageDescriber(
      fakeAdapter(() => {
        throw new Error('boom')
      }),
    )
    assert.equal(await describer.describe(image(), models), undefined)
  })
})

test.describe('ImageDescriber.describeMessageImages', () => {
  test('fills descriptions for undescribed images, in place', async () => {
    const describer = new ImageDescriber(
      fakeAdapter((req) => botRes(`desc-${req.prevItems[0].humanMessage?.images?.[0].id}`)),
    )
    const message: IChatMessage = { text: 'hi', images: [image({ id: 'a' }), image({ id: 'b' })] }

    await describer.describeMessageImages(message, models)

    assert.equal(message.images?.[0].description, 'desc-a')
    assert.equal(message.images?.[1].description, 'desc-b')
  })

  test('does not re-describe images that already have a description', async () => {
    let calls = 0
    const describer = new ImageDescriber(
      fakeAdapter(() => {
        calls++
        return botRes('new')
      }),
    )
    const message: IChatMessage = { images: [image({ id: 'a', description: 'existing' })] }

    await describer.describeMessageImages(message, models)

    assert.equal(calls, 0)
    assert.equal(message.images?.[0].description, 'existing')
  })

  test('is a no-op with no images or no models', async () => {
    let calls = 0
    const describer = new ImageDescriber(
      fakeAdapter(() => {
        calls++
        return botRes('x')
      }),
    )

    await describer.describeMessageImages({ text: 'no images' }, models)
    await describer.describeMessageImages({ images: [image()] }, [])

    assert.equal(calls, 0)
  })
})
