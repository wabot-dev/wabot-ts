import { IChatAdapter, IFunctionCall } from '@/feature/chat-bot'
import { IMindsetTool } from '@/feature/mindset'
import assert from 'node:assert'
import { test } from 'node:test'

export interface ItestChatAdapterReq {
  adapter: IChatAdapter
  model: string
}

export function testChatAdapter({ adapter, model }: ItestChatAdapterReq) {
  test('bot responds to human message', async () => {
    const { nextItems } = await adapter.nextItems({
      model,
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
      model,
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
  })

  test('throws when the request is invalid', async () => {
    const responsePromise = adapter.nextItems({
      model,
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
      model,
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

    const { nextItems } = await adapter.nextItems({
      model,
      tools,
      systemPrompt: 'Act as a Bot',
      prevItems: [
        {
          type: 'humanMessage',
          humanMessage: {
            text: 'What is the time in Colombia',
          },
        },
        {
          type: 'functionCall',
          functionCall: {
            id: 'id_erksndfooqne',
            name: 'getCountryTime',
            arguments: '{"country": "CO"}',
            result: '2023-10-12T12:00:00.000Z',
          },
        },
      ],
    })

    assert(Array.isArray(nextItems), 'nextItems is not array')
    assert(nextItems.length === 1, 'nexItems length should be 1')
    assert(nextItems[0].type === 'botMessage', 'next item should have botMessage type')
  })

  test('consume public image', async () => {
    const { nextItems } = await adapter.nextItems({
      model,
      tools: [],
      systemPrompt: 'Act as a Bot',
      prevItems: [
        {
          type: 'humanMessage',
          humanMessage: {
            images: [
              {
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
      model,
      tools: [],
      systemPrompt: 'Act as a Bot',
      prevItems: [
        {
          type: 'humanMessage',
          humanMessage: {
            images: [
              {
                mimeType: 'image/png',
                base64Url:
                  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA AAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO 9TXL0Y4OHwAAAABJRU5ErkJggg==',
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
