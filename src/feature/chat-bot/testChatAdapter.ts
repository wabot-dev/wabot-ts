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
    assert(
      typeof usage.provider === 'string' && usage.provider.length > 0,
      'usage.provider should be a non-empty string',
    )
    assert(
      typeof usage.model === 'string' && usage.model.length > 0,
      'usage.model should be a non-empty string',
    )
    if (usage.cacheReadTokens !== undefined) {
      assert(
        typeof usage.cacheReadTokens === 'number',
        'cacheReadTokens should be a number when present',
      )
      assert(usage.cacheReadTokens >= 0, 'cacheReadTokens should be non-negative')
    }
    if (usage.cacheWriteTokens !== undefined) {
      assert(
        typeof usage.cacheWriteTokens === 'number',
        'cacheWriteTokens should be a number when present',
      )
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
        parameters: [
          {
            name: 'country',
            required: true,
            schema: { type: 'string', description: 'the country iso code' },
          },
        ],
        description: 'return the current time of a country',
      },
      {
        language: 'english',
        name: 'getCountryMainLanguage',
        parameters: [
          {
            name: 'country',
            required: true,
            schema: { type: 'string', description: 'the country iso code' },
          },
        ],
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
        parameters: [
          {
            name: 'country',
            required: true,
            schema: { type: 'string', description: 'the country iso code' },
          },
        ],
        description: 'return the current time of a country',
      },
      {
        language: 'english',
        name: 'getCountryMainLanguage',
        parameters: [
          {
            name: 'country',
            required: true,
            schema: { type: 'string', description: 'the country iso code' },
          },
        ],
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

  test('call tool with array-of-string parameter', async () => {
    const tools: IMindsetTool[] = [
      {
        language: 'english',
        name: 'lookupCountries',
        description: 'Look up information about a list of countries',
        parameters: [
          {
            name: 'countryCodes',
            required: true,
            schema: {
              type: 'array',
              description: 'ISO codes of the countries to look up',
              items: { type: 'string' },
            },
          },
        ],
      },
    ]

    const { nextItems } = await adapter.nextItems({
      models,
      tools,
      systemPrompt:
        'Act as a Bot. Always call lookupCountries when the user mentions multiple countries.',
      prevItems: [
        {
          type: 'humanMessage',
          humanMessage: { text: 'Look up info for Colombia, Argentina and Brazil' },
        },
      ],
    })

    const functionCallItem = nextItems.find((x) => x.type === 'functionCall')
    assert(functionCallItem != null, 'nextItems should contain a functionCall item')
    assert(
      functionCallItem.functionCall.name === 'lookupCountries',
      'function call should target lookupCountries',
    )

    const args = JSON.parse(functionCallItem.functionCall.arguments ?? '{}')
    assert(Array.isArray(args.countryCodes), 'countryCodes should be an array')
    assert(args.countryCodes.length >= 2, 'countryCodes should contain multiple entries')
    for (const code of args.countryCodes) {
      assert(typeof code === 'string', 'each countryCodes item should be a string')
    }
  })

  test('call tool with array-of-number parameter', async () => {
    const tools: IMindsetTool[] = [
      {
        language: 'english',
        name: 'sumNumbers',
        description: 'Compute the sum of a list of numbers',
        parameters: [
          {
            name: 'numbers',
            required: true,
            schema: {
              type: 'array',
              description: 'Numbers to add together',
              items: { type: 'number' },
            },
          },
        ],
      },
    ]

    const { nextItems } = await adapter.nextItems({
      models,
      tools,
      systemPrompt: 'Act as a Bot. Always use sumNumbers to add lists of numbers.',
      prevItems: [
        {
          type: 'humanMessage',
          humanMessage: { text: 'What is the sum of 3, 5, 7 and 11?' },
        },
      ],
    })

    const functionCallItem = nextItems.find((x) => x.type === 'functionCall')
    assert(functionCallItem != null, 'nextItems should contain a functionCall item')
    assert(
      functionCallItem.functionCall.name === 'sumNumbers',
      'function call should target sumNumbers',
    )

    const args = JSON.parse(functionCallItem.functionCall.arguments ?? '{}')
    assert(Array.isArray(args.numbers), 'numbers should be an array')
    assert(args.numbers.length >= 2, 'numbers should contain multiple entries')
    for (const value of args.numbers) {
      assert(typeof value === 'number', 'each numbers item should be a number')
    }
  })

  test('call tool with multiple mixed-type parameters', async () => {
    const tools: IMindsetTool[] = [
      {
        language: 'english',
        name: 'scheduleMeeting',
        description: 'Schedule a meeting on the calendar',
        parameters: [
          {
            name: 'title',
            required: true,
            schema: { type: 'string', description: 'meeting title' },
          },
          {
            name: 'durationMinutes',
            required: true,
            schema: { type: 'number', description: 'duration in minutes' },
          },
          {
            name: 'attendees',
            required: true,
            schema: {
              type: 'array',
              description: 'list of attendee emails',
              items: { type: 'string' },
            },
          },
        ],
      },
    ]

    const { nextItems } = await adapter.nextItems({
      models,
      tools,
      systemPrompt: 'Act as a Bot. Always use scheduleMeeting when asked to schedule a meeting.',
      prevItems: [
        {
          type: 'humanMessage',
          humanMessage: {
            text: 'Schedule a 30 minute meeting titled "Quarterly Review" with alice@x.com and bob@x.com',
          },
        },
      ],
    })

    const functionCallItem = nextItems.find((x) => x.type === 'functionCall')
    assert(functionCallItem != null, 'nextItems should contain a functionCall item')
    assert(
      functionCallItem.functionCall.name === 'scheduleMeeting',
      'function call should target scheduleMeeting',
    )

    const args = JSON.parse(functionCallItem.functionCall.arguments ?? '{}')
    assert(typeof args.title === 'string' && args.title.length > 0, 'title should be a string')
    assert(
      typeof args.durationMinutes === 'number' && args.durationMinutes > 0,
      'durationMinutes should be a positive number',
    )
    assert(Array.isArray(args.attendees), 'attendees should be an array')
    assert(args.attendees.length >= 2, 'attendees should contain multiple entries')
    for (const attendee of args.attendees) {
      assert(typeof attendee === 'string', 'each attendee should be a string')
    }
  })

  test('call tool with enum parameter', async () => {
    const tools: IMindsetTool[] = [
      {
        language: 'english',
        name: 'setTaskPriority',
        description:
          'Set the priority of the current task. The level must be one of "low", "medium" or "high".',
        parameters: [
          {
            name: 'level',
            required: true,
            schema: {
              type: 'string',
              description: 'priority level, one of low, medium or high',
              enum: ['low', 'medium', 'high'],
            },
          },
        ],
      },
    ]

    const { nextItems } = await adapter.nextItems({
      models,
      tools,
      systemPrompt:
        'Act as a Bot. You MUST call the setTaskPriority tool whenever the user wants to change a task priority. Do not respond with plain text in that case.',
      prevItems: [
        {
          type: 'humanMessage',
          humanMessage: {
            text: 'Use the setTaskPriority tool to mark this task as the highest priority.',
          },
        },
      ],
    })

    const functionCallItem = nextItems.find((x) => x.type === 'functionCall')
    assert(functionCallItem != null, 'nextItems should contain a functionCall item')
    assert(
      functionCallItem.functionCall.name === 'setTaskPriority',
      'function call should target setTaskPriority',
    )

    const args = JSON.parse(functionCallItem.functionCall.arguments ?? '{}')
    assert(
      ['low', 'medium', 'high'].includes(args.level),
      `level should be one of low/medium/high, got '${args.level}'`,
    )
  })

  test('call tool with nested object parameter', async () => {
    const tools: IMindsetTool[] = [
      {
        language: 'english',
        name: 'registerUser',
        description: 'Register a new user',
        parameters: [
          {
            name: 'user',
            required: true,
            schema: {
              type: 'object',
              description: 'user information',
              properties: {
                name: { type: 'string', description: 'full name' },
                age: { type: 'number', description: 'age in years' },
              },
              required: ['name', 'age'],
              additionalProperties: false,
            },
          },
        ],
      },
    ]

    const { nextItems } = await adapter.nextItems({
      models,
      tools,
      systemPrompt: 'Act as a Bot. Always use registerUser when asked to register someone.',
      prevItems: [
        {
          type: 'humanMessage',
          humanMessage: { text: 'Register user Jorge Narvaez, 30 years old' },
        },
      ],
    })

    const functionCallItem = nextItems.find((x) => x.type === 'functionCall')
    assert(functionCallItem != null, 'nextItems should contain a functionCall item')
    assert(
      functionCallItem.functionCall.name === 'registerUser',
      'function call should target registerUser',
    )

    const args = JSON.parse(functionCallItem.functionCall.arguments ?? '{}')
    assert(args.user != null && typeof args.user === 'object', 'user should be an object')
    assert(typeof args.user.name === 'string', 'user.name should be a string')
    assert(typeof args.user.age === 'number', 'user.age should be a number')
  })

  test('call tool with only required parameter omitting the optional one', async () => {
    const tools: IMindsetTool[] = [
      {
        language: 'english',
        name: 'searchProducts',
        description: 'Search the catalog of products',
        parameters: [
          {
            name: 'query',
            required: true,
            schema: { type: 'string', description: 'search keywords' },
          },
          {
            name: 'limit',
            required: false,
            schema: { type: 'number', description: 'maximum number of results' },
          },
        ],
      },
    ]

    const { nextItems } = await adapter.nextItems({
      models,
      tools,
      systemPrompt: 'Act as a Bot. Always use searchProducts when the user wants to search.',
      prevItems: [
        {
          type: 'humanMessage',
          humanMessage: { text: 'Search for red running shoes' },
        },
      ],
    })

    const functionCallItem = nextItems.find((x) => x.type === 'functionCall')
    assert(functionCallItem != null, 'nextItems should contain a functionCall item')
    assert(
      functionCallItem.functionCall.name === 'searchProducts',
      'function call should target searchProducts',
    )

    const args = JSON.parse(functionCallItem.functionCall.arguments ?? '{}')
    assert(typeof args.query === 'string' && args.query.length > 0, 'query should be a string')
  })

  test('call tool with no parameters', async () => {
    const tools: IMindsetTool[] = [
      {
        language: 'english',
        name: 'getCurrentServerTime',
        description:
          'Get the authoritative current server time as an ISO 8601 string. This is the ONLY way to obtain the current time; the model does not know it. Always call this tool when the user asks for the current time.',
        parameters: [],
      },
    ]

    const { nextItems } = await adapter.nextItems({
      models,
      tools,
      systemPrompt:
        'Act as a Bot. You do NOT know the current time and have no way to compute it. The ONLY way to learn the current time is to call the getCurrentServerTime tool. Whenever the user asks anything related to the current time, you MUST call getCurrentServerTime. Do not answer with text in that case.',
      prevItems: [
        {
          type: 'humanMessage',
          humanMessage: {
            text: 'Invoke the getCurrentServerTime tool right now to retrieve the current server time and tell me what it returns.',
          },
        },
      ],
    })

    const functionCallItem = nextItems.find((x) => x.type === 'functionCall')
    assert(functionCallItem != null, 'nextItems should contain a functionCall item')
    assert(
      functionCallItem.functionCall.name === 'getCurrentServerTime',
      'function call should target getCurrentServerTime',
    )
  })
}
