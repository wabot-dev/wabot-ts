import { IChatAdapter, IChatItem, IFunctionCall } from '@/feature/chat-bot'
import { IMindsetModelRef, IMindsetTool } from '@/feature/mindset'
import assert from 'node:assert'
import { test } from 'node:test'

export interface ItestChatAdapterReq {
  adapter: IChatAdapter
  model: string
}

export function testChatAdapter({ adapter, model }: ItestChatAdapterReq) {
  const models: IMindsetModelRef[] = [{ model }]
  test('bot responds to human message', async () => {
    const { nextItems } = await adapter.nextItems({
      models,
      tools: [],
      systemPrompt: 'Act as a Bot',
      prevItems: [
        {
          type: 'humanMessage',
          humanMessage: {
            text: 'Hello',
          },
        },
      ],
    })

    assert(Array.isArray(nextItems), 'nextItems is not array')
    assert(nextItems.length === 1, 'nexItems length should be 1')
    assert(nextItems[0].type === 'botMessage', 'next item should have botMessage type')
  })

  test('response include usage', async () => {
    const { usage } = await adapter.nextItems({
      models,
      tools: [],
      systemPrompt: 'Act as a Bot',
      prevItems: [
        {
          type: 'humanMessage',
          humanMessage: {
            text: 'Hello',
          },
        },
      ],
    })
    assert(usage != null, 'usage should be defined')
    assert(typeof usage === 'object', 'usage should be an object')
    assert(typeof usage.inputTokens === 'number', 'inputTokens should be number')
    assert(typeof usage.outputTokens === 'number', 'outputTokens should be number')
    assert(usage.inputTokens > 0, 'inputTokens should be positive')
    assert(usage.outputTokens > 0, 'outputTokens should be positive')
    assert(typeof usage.provider === 'string' && usage.provider.length > 0, 'usage.provider should be a non-empty string')
    assert(typeof usage.model === 'string' && usage.model.length > 0, 'usage.model should be a non-empty string')
    if (usage.cacheReadTokens !== undefined) {
      assert(typeof usage.cacheReadTokens === 'number', 'cacheReadTokens should be a number when present')
      assert(usage.cacheReadTokens >= 0, 'cacheReadTokens should be non-negative')
    }
    if (usage.cacheWriteTokens !== undefined) {
      assert(typeof usage.cacheWriteTokens === 'number', 'cacheWriteTokens should be a number when present')
      assert(usage.cacheWriteTokens >= 0, 'cacheWriteTokens should be non-negative')
    }
    if (usage.costUsd !== undefined) {
      assert(typeof usage.costUsd === 'number', 'costUsd should be a number when present')
      assert(usage.costUsd >= 0, 'costUsd should be non-negative')
    }
  })

  test('throws when the request is invalid', async () => {
    const responsePromise = adapter.nextItems({
      models,
      tools: [],
      systemPrompt: 'Act as a Bot',
      prevItems: [
        {
          type: 'humanMessage',
          botMessage: {
            text: 'Hello',
          },
        } as any,
      ],
    })

    await assert.rejects(responsePromise)
  })

  test('call the appropiate tool', async () => {
    const tools: IMindsetTool[] = [
      {
        language: 'english',
        name: 'getCountryTime',
        parameters: [{ name: 'country', type: 'string', description: 'the country iso code' }],
        description: 'return the current time of a country',
      },
      {
        language: 'english',
        name: 'getCountryMainLanguage',
        parameters: [{ name: 'country', type: 'string', description: 'the country iso code' }],
        description: 'return the main language of a country',
      },
    ]

    const { nextItems } = await adapter.nextItems({
      models,
      tools,
      systemPrompt: 'Act as a Bot',
      prevItems: [
        {
          type: 'humanMessage',
          humanMessage: {
            text: 'I am from Colombia',
          },
        },
        {
          type: 'botMessage',
          botMessage: {
            text: 'That is a great country',
          },
        },
        {
          type: 'humanMessage',
          humanMessage: {
            text: 'What is the current time in my country',
          },
        },
      ],
    })

    assert(Array.isArray(nextItems), 'nextItems is not array')

    const functionCallItem = nextItems.find((x) => x.type === 'functionCall')
    assert(functionCallItem != null, 'nextItems should contain one functionCall Item')

    const functionCall: IFunctionCall = functionCallItem.functionCall

    assert(functionCall.id != null, 'function call id should be defined')
    assert(functionCall.name === 'getCountryTime', 'function call name should be getCountryTime')
    assert(typeof functionCall.arguments === 'string', 'function call arguments should be string')

    const args = JSON.parse(functionCall.arguments)
    assert(typeof args === 'object', 'function call argument should be an object')
    assert(typeof args.country === 'string', 'country argument should be string')
  })

  test('consume function calls response', async () => {
    const tools: IMindsetTool[] = [
      {
        language: 'english',
        name: 'getCountryTime',
        parameters: [{ name: 'country', type: 'string', description: 'the country iso code' }],
        description: 'return the current time of a country',
      },
      {
        language: 'english',
        name: 'getCountryMainLanguage',
        parameters: [{ name: 'country', type: 'string', description: 'the country iso code' }],
        description: 'return the main language of a country',
      },
    ]

    const humanTurn: IChatItem = {
      type: 'humanMessage',
      humanMessage: { text: 'What is the time in Colombia' },
    }

    const firstTurn = await adapter.nextItems({
      models,
      tools,
      systemPrompt: 'Act as a Bot',
      prevItems: [humanTurn],
    })

    const callItems = firstTurn.nextItems.filter((x) => x.type === 'functionCall')
    assert(callItems.length > 0, 'first turn should contain at least one functionCall item')

    const resolvedCallItems: IChatItem[] = callItems.map((item) => ({
      type: 'functionCall',
      functionCall: {
        ...item.functionCall,
        result: '2023-10-12T12:00:00.000Z',
      },
    }))

    const { nextItems } = await adapter.nextItems({
      models,
      tools,
      systemPrompt: 'Act as a Bot',
      prevItems: [humanTurn, ...resolvedCallItems],
    })

    assert(Array.isArray(nextItems), 'nextItems is not array')
    assert(nextItems.length === 1, 'nexItems length should be 1')
    assert(nextItems[0].type === 'botMessage', 'next item should have botMessage type')
  })

  test('consume public image', async () => {
    const { nextItems } = await adapter.nextItems({
      models,
      tools: [],
      systemPrompt: 'Act as a Bot',
      prevItems: [
        {
          type: 'humanMessage',
          humanMessage: {
            images: [
              {
                id: 'image1',
                mimeType: 'image/jpeg',
                publicUrl:
                  'https://www.shutterstock.com/shutterstock/photos/2499249955/display_1500/stock-photo-baby-anaconda-at-the-rainforest-cuyabeno-amazonas-in-ecuador-2499249955.jpg',
              },
            ],
          },
        },
      ],
    })

    assert(Array.isArray(nextItems), 'nextItems is not array')
    assert(nextItems.length === 1, 'nexItems length should be 1')
    assert(nextItems[0].type === 'botMessage', 'next item should have botMessage type')
  })

  test('consume private image', async () => {
    const { nextItems } = await adapter.nextItems({
      models,
      tools: [],
      systemPrompt: 'Act as a Bot',
      prevItems: [
        {
          type: 'humanMessage',
          humanMessage: {
            images: [
              {
                id: 'image1',
                mimeType: 'image/png',
                base64Url:
                  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==',
              },
            ],
          },
        },
      ],
    })

    assert(Array.isArray(nextItems), 'nextItems is not array')
    assert(nextItems.length === 1, 'nexItems length should be 1')
    assert(nextItems[0].type === 'botMessage', 'next item should have botMessage type')
  })

  test('consume public document', async () => {
    const { nextItems } = await adapter.nextItems({
      models,
      tools: [],
      systemPrompt: 'Act as a Bot',
      prevItems: [
        {
          type: 'humanMessage',
          humanMessage: {
            documents: [
              {
                id: 'doc1',
                mimeType: 'application/pdf',
                publicUrl:
                  'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf',
              },
            ],
          },
        },
      ],
    })

    assert(Array.isArray(nextItems), 'nextItems is not array')
    assert(nextItems.length === 1, 'nexItems length should be 1')
    assert(nextItems[0].type === 'botMessage', 'next item should have botMessage type')
  })

  test('consume private document', async () => {
    const { nextItems } = await adapter.nextItems({
      models,
      tools: [],
      systemPrompt: 'Act as a Bot',
      prevItems: [
        {
          type: 'humanMessage',
          humanMessage: {
            documents: [
              {
                id: 'doc1',
                mimeType: 'application/pdf',
                base64Url:
                  'data:application/pdf;base64,JVBERi0xLjEKMSAwIG9iajw8L1R5cGUvQ2F0YWxvZy9QYWdlcyAyIDAgUj4+ZW5kb2JqCjIgMCBvYmo8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PmVuZG9iagozIDAgb2JqPDwvVHlwZS9QYWdlL1BhcmVudCAyIDAgUi9NZWRpYUJveFswIDAgMjAwIDIwMF0vUmVzb3VyY2VzPDwvRm9udDw8L0YxPDwvVHlwZS9Gb250L1N1YnR5cGUvVHlwZTEvQmFzZUZvbnQvSGVsdmV0aWNhPj4+Pj4+L0NvbnRlbnRzIDQgMCBSPj5lbmRvYmoKNCAwIG9iajw8L0xlbmd0aCA0ND4+c3RyZWFtCkJUIC9GMSAxMiBUZiA1MCAxMDAgVGQgKEhlbGxvIFdvcmxkKSBUaiBFVAplbmRzdHJlYW0gZW5kb2JqCnhyZWYKMCA1CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAwOSAwMDAwMCBuIAowMDAwMDAwMDUzIDAwMDAwIG4gCjAwMDAwMDAwOTggMDAwMDAgbiAKMDAwMDAwMDIyOCAwMDAwMCBuIAp0cmFpbGVyPDwvU2l6ZSA1L1Jvb3QgMSAwIFI+PgpzdGFydHhyZWYKMzIwCiUlRU9GCg==',
              },
            ],
          },
        },
      ],
    })

    assert(Array.isArray(nextItems), 'nextItems is not array')
    assert(nextItems.length === 1, 'nexItems length should be 1')
    assert(nextItems[0].type === 'botMessage', 'next item should have botMessage type')
  })

  test('throws when human message has no content', async () => {
    const responsePromise = adapter.nextItems({
      models,
      tools: [],
      systemPrompt: 'Act as a Bot',
      prevItems: [
        {
          type: 'humanMessage',
          humanMessage: {},
        },
      ],
    })
    await assert.rejects(responsePromise)
  })

  test('consume object-only human message', async () => {
    const { nextItems } = await adapter.nextItems({
      models,
      tools: [],
      systemPrompt: 'Act as a Bot',
      prevItems: [
        {
          type: 'humanMessage',
          humanMessage: {
            object: { user: 'Jorge', country: 'Colombia' },
          },
        },
      ],
    })

    assert(Array.isArray(nextItems), 'nextItems is not array')
    assert(nextItems.length === 1, 'nexItems length should be 1')
    assert(nextItems[0].type === 'botMessage', 'next item should have botMessage type')
  })

  test('skips unsupported image format without crashing', async () => {
    const { nextItems } = await adapter.nextItems({
      models,
      tools: [],
      systemPrompt: 'Act as a Bot',
      prevItems: [
        {
          type: 'humanMessage',
          humanMessage: {
            text: 'Describe what I sent',
            images: [
              {
                id: 'image1',
                mimeType: 'image/bmp',
                publicUrl: 'https://example.com/sample.bmp',
              },
            ],
          },
        },
      ],
    })

    assert(Array.isArray(nextItems), 'nextItems is not array')
    assert(nextItems.length === 1, 'nexItems length should be 1')
    assert(nextItems[0].type === 'botMessage', 'next item should have botMessage type')
  })
}
