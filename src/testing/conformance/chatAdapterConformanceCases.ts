import { IChatAdapter, IChatItem, IFunctionCall } from '@/feature/chat-bot'
import { IMindsetModelRef, IMindsetTool } from '@/feature/mindset'

import { testImageBase64Url, testPdfBase64Url } from '../fixtures'

export interface IChatAdapterConformanceReq {
  adapter: IChatAdapter
  model: string
}

export interface IChatAdapterConformanceCase {
  name: string
  run: () => Promise<void>
}

function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

async function ensureRejects(promise: Promise<unknown>, message: string): Promise<void> {
  let rejected = false
  try {
    await promise
  } catch {
    rejected = true
  }
  ensure(rejected, message)
}

/**
 * Provider-agnostic conformance suite for IChatAdapter implementations.
 * Runner-agnostic: each case is a plain async function, so it can be wired
 * to node:test, vitest or bun test by the caller.
 */
export function chatAdapterConformanceCases({
  adapter,
  model,
}: IChatAdapterConformanceReq): IChatAdapterConformanceCase[] {
  const models: IMindsetModelRef[] = [{ model }]

  const countryTools: IMindsetTool[] = [
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

  return [
    {
      name: 'bot responds to human message',
      run: async () => {
        const { nextItems } = await adapter.nextItems({
          models,
          tools: [],
          systemPrompt: 'Act as a Bot',
          prevItems: [{ type: 'humanMessage', humanMessage: { text: 'Hello' } }],
        })

        ensure(Array.isArray(nextItems), 'nextItems is not array')
        ensure(nextItems.length === 1, 'nexItems length should be 1')
        ensure(nextItems[0].type === 'botMessage', 'next item should have botMessage type')
      },
    },
    {
      name: 'response include usage',
      run: async () => {
        const { usage } = await adapter.nextItems({
          models,
          tools: [],
          systemPrompt: 'Act as a Bot',
          prevItems: [{ type: 'humanMessage', humanMessage: { text: 'Hello' } }],
        })
        ensure(usage != null, 'usage should be defined')
        ensure(typeof usage === 'object', 'usage should be an object')
        ensure(typeof usage.inputTokens === 'number', 'inputTokens should be number')
        ensure(typeof usage.outputTokens === 'number', 'outputTokens should be number')
        ensure(usage.inputTokens > 0, 'inputTokens should be positive')
        ensure(usage.outputTokens > 0, 'outputTokens should be positive')
        ensure(
          typeof usage.provider === 'string' && usage.provider.length > 0,
          'usage.provider should be a non-empty string',
        )
        ensure(
          typeof usage.model === 'string' && usage.model.length > 0,
          'usage.model should be a non-empty string',
        )
        if (usage.cacheReadTokens !== undefined) {
          ensure(
            typeof usage.cacheReadTokens === 'number',
            'cacheReadTokens should be a number when present',
          )
          ensure(usage.cacheReadTokens >= 0, 'cacheReadTokens should be non-negative')
        }
        if (usage.cacheWriteTokens !== undefined) {
          ensure(
            typeof usage.cacheWriteTokens === 'number',
            'cacheWriteTokens should be a number when present',
          )
          ensure(usage.cacheWriteTokens >= 0, 'cacheWriteTokens should be non-negative')
        }
        if (usage.costUsd !== undefined) {
          ensure(typeof usage.costUsd === 'number', 'costUsd should be a number when present')
          ensure(usage.costUsd >= 0, 'costUsd should be non-negative')
        }
      },
    },
    {
      name: 'throws when the request is invalid',
      run: async () => {
        const responsePromise = adapter.nextItems({
          models,
          tools: [],
          systemPrompt: 'Act as a Bot',
          prevItems: [
            {
              type: 'humanMessage',
              botMessage: { text: 'Hello' },
            } as any,
          ],
        })

        await ensureRejects(responsePromise, 'adapter should reject an invalid request')
      },
    },
    {
      name: 'call the appropiate tool',
      run: async () => {
        const { nextItems } = await adapter.nextItems({
          models,
          tools: countryTools,
          systemPrompt: 'Act as a Bot',
          prevItems: [
            { type: 'humanMessage', humanMessage: { text: 'I am from Colombia' } },
            { type: 'botMessage', botMessage: { text: 'That is a great country' } },
            {
              type: 'humanMessage',
              humanMessage: { text: 'What is the current time in my country' },
            },
          ],
        })

        ensure(Array.isArray(nextItems), 'nextItems is not array')

        const functionCallItem = nextItems.find((x) => x.type === 'functionCall')
        ensure(functionCallItem != null, 'nextItems should contain one functionCall Item')

        const functionCall: IFunctionCall = functionCallItem.functionCall
        ensure(functionCall.id != null, 'function call id should be defined')
        ensure(
          functionCall.name === 'getCountryTime',
          'function call name should be getCountryTime',
        )
        ensure(
          typeof functionCall.arguments === 'string',
          'function call arguments should be string',
        )

        const args = JSON.parse(functionCall.arguments)
        ensure(typeof args === 'object', 'function call argument should be an object')
        ensure(typeof args.country === 'string', 'country argument should be string')
      },
    },
    {
      name: 'consume function calls response',
      run: async () => {
        const humanTurn: IChatItem = {
          type: 'humanMessage',
          humanMessage: { text: 'What is the time in Colombia' },
        }

        const firstTurn = await adapter.nextItems({
          models,
          tools: countryTools,
          systemPrompt: 'Act as a Bot',
          prevItems: [humanTurn],
        })

        const callItems = firstTurn.nextItems.filter((x) => x.type === 'functionCall')
        ensure(callItems.length > 0, 'first turn should contain at least one functionCall item')

        const resolvedCallItems: IChatItem[] = callItems.map((item) => ({
          type: 'functionCall',
          functionCall: {
            ...item.functionCall,
            result: '2023-10-12T12:00:00.000Z',
          },
        }))

        const { nextItems } = await adapter.nextItems({
          models,
          tools: countryTools,
          systemPrompt: 'Act as a Bot',
          prevItems: [humanTurn, ...resolvedCallItems],
        })

        ensure(Array.isArray(nextItems), 'nextItems is not array')
        ensure(nextItems.length === 1, 'nexItems length should be 1')
        ensure(nextItems[0].type === 'botMessage', 'next item should have botMessage type')
      },
    },
    {
      name: 'consume public image',
      run: async () => {
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
                    publicUrl:
                      'https://raw.githubusercontent.com/github/explore/main/topics/python/python.png',
                  },
                ],
              },
            },
          ],
        })

        ensure(Array.isArray(nextItems), 'nextItems is not array')
        ensure(nextItems.length === 1, 'nexItems length should be 1')
        ensure(nextItems[0].type === 'botMessage', 'next item should have botMessage type')
      },
    },
    {
      name: 'consume private image',
      run: async () => {
        const { nextItems } = await adapter.nextItems({
          models,
          tools: [],
          systemPrompt: 'Act as a Bot',
          prevItems: [
            {
              type: 'humanMessage',
              humanMessage: {
                images: [{ id: 'image1', mimeType: 'image/jpeg', base64Url: testImageBase64Url }],
              },
            },
          ],
        })

        ensure(Array.isArray(nextItems), 'nextItems is not array')
        ensure(nextItems.length === 1, 'nexItems length should be 1')
        ensure(nextItems[0].type === 'botMessage', 'next item should have botMessage type')
      },
    },
    {
      name: 'reads the total price from a receipt image',
      run: async () => {
        const { nextItems } = await adapter.nextItems({
          models,
          tools: [],
          systemPrompt: 'Act as a Bot',
          prevItems: [
            {
              type: 'humanMessage',
              humanMessage: {
                text: 'This is a store receipt. What is the total price? Reply with the number only.',
                images: [{ id: 'receipt', mimeType: 'image/jpeg', base64Url: testImageBase64Url }],
              },
            },
          ],
        })

        ensure(Array.isArray(nextItems), 'nextItems is not array')
        ensure(nextItems.length === 1, 'nexItems length should be 1')
        ensure(nextItems[0].type === 'botMessage', 'next item should have botMessage type')

        const text = nextItems[0].botMessage.text ?? ''
        const digits = text.replace(/[^0-9]/g, '')
        ensure(
          digits.includes('11570'),
          `bot response should report the total 11.570, got '${text}'`,
        )
      },
    },
    {
      name: 'consume public document',
      run: async () => {
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

        ensure(Array.isArray(nextItems), 'nextItems is not array')
        ensure(nextItems.length === 1, 'nexItems length should be 1')
        ensure(nextItems[0].type === 'botMessage', 'next item should have botMessage type')
      },
    },
    {
      name: 'consume private document',
      run: async () => {
        const { nextItems } = await adapter.nextItems({
          models,
          tools: [],
          systemPrompt: 'Act as a Bot',
          prevItems: [
            {
              type: 'humanMessage',
              humanMessage: {
                documents: [
                  { id: 'doc1', mimeType: 'application/pdf', base64Url: testPdfBase64Url },
                ],
              },
            },
          ],
        })

        ensure(Array.isArray(nextItems), 'nextItems is not array')
        ensure(nextItems.length === 1, 'nexItems length should be 1')
        ensure(nextItems[0].type === 'botMessage', 'next item should have botMessage type')
      },
    },
    {
      name: 'throws when human message has no content',
      run: async () => {
        const responsePromise = adapter.nextItems({
          models,
          tools: [],
          systemPrompt: 'Act as a Bot',
          prevItems: [{ type: 'humanMessage', humanMessage: {} }],
        })
        await ensureRejects(responsePromise, 'adapter should reject an empty human message')
      },
    },
    {
      name: 'consume object-only human message',
      run: async () => {
        const { nextItems } = await adapter.nextItems({
          models,
          tools: [],
          systemPrompt: 'Act as a Bot',
          prevItems: [
            {
              type: 'humanMessage',
              humanMessage: { object: { user: 'Jorge', country: 'Colombia' } },
            },
          ],
        })

        ensure(Array.isArray(nextItems), 'nextItems is not array')
        ensure(nextItems.length === 1, 'nexItems length should be 1')
        ensure(nextItems[0].type === 'botMessage', 'next item should have botMessage type')
      },
    },
    {
      name: 'skips unsupported image format without crashing',
      run: async () => {
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

        ensure(Array.isArray(nextItems), 'nextItems is not array')
        ensure(nextItems.length === 1, 'nexItems length should be 1')
        ensure(nextItems[0].type === 'botMessage', 'next item should have botMessage type')
      },
    },
    {
      name: 'call tool with array-of-string parameter',
      run: async () => {
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
        ensure(functionCallItem != null, 'nextItems should contain a functionCall item')
        ensure(
          functionCallItem.functionCall.name === 'lookupCountries',
          'function call should target lookupCountries',
        )

        const args = JSON.parse(functionCallItem.functionCall.arguments ?? '{}')
        ensure(Array.isArray(args.countryCodes), 'countryCodes should be an array')
        ensure(args.countryCodes.length >= 2, 'countryCodes should contain multiple entries')
        for (const code of args.countryCodes) {
          ensure(typeof code === 'string', 'each countryCodes item should be a string')
        }
      },
    },
    {
      name: 'call tool with array-of-number parameter',
      run: async () => {
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
        ensure(functionCallItem != null, 'nextItems should contain a functionCall item')
        ensure(
          functionCallItem.functionCall.name === 'sumNumbers',
          'function call should target sumNumbers',
        )

        const args = JSON.parse(functionCallItem.functionCall.arguments ?? '{}')
        ensure(Array.isArray(args.numbers), 'numbers should be an array')
        ensure(args.numbers.length >= 2, 'numbers should contain multiple entries')
        for (const value of args.numbers) {
          ensure(typeof value === 'number', 'each numbers item should be a number')
        }
      },
    },
    {
      name: 'call tool with multiple mixed-type parameters',
      run: async () => {
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
          systemPrompt:
            'Act as a Bot. Always use scheduleMeeting when asked to schedule a meeting.',
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
        ensure(functionCallItem != null, 'nextItems should contain a functionCall item')
        ensure(
          functionCallItem.functionCall.name === 'scheduleMeeting',
          'function call should target scheduleMeeting',
        )

        const args = JSON.parse(functionCallItem.functionCall.arguments ?? '{}')
        ensure(typeof args.title === 'string' && args.title.length > 0, 'title should be a string')
        ensure(
          typeof args.durationMinutes === 'number' && args.durationMinutes > 0,
          'durationMinutes should be a positive number',
        )
        ensure(Array.isArray(args.attendees), 'attendees should be an array')
        ensure(args.attendees.length >= 2, 'attendees should contain multiple entries')
        for (const attendee of args.attendees) {
          ensure(typeof attendee === 'string', 'each attendee should be a string')
        }
      },
    },
    {
      name: 'call tool with enum parameter',
      run: async () => {
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
        ensure(functionCallItem != null, 'nextItems should contain a functionCall item')
        ensure(
          functionCallItem.functionCall.name === 'setTaskPriority',
          'function call should target setTaskPriority',
        )

        const args = JSON.parse(functionCallItem.functionCall.arguments ?? '{}')
        ensure(
          ['low', 'medium', 'high'].includes(args.level),
          `level should be one of low/medium/high, got '${args.level}'`,
        )
      },
    },
    {
      name: 'call tool with nested object parameter',
      run: async () => {
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
        ensure(functionCallItem != null, 'nextItems should contain a functionCall item')
        ensure(
          functionCallItem.functionCall.name === 'registerUser',
          'function call should target registerUser',
        )

        const args = JSON.parse(functionCallItem.functionCall.arguments ?? '{}')
        ensure(args.user != null && typeof args.user === 'object', 'user should be an object')
        ensure(typeof args.user.name === 'string', 'user.name should be a string')
        ensure(typeof args.user.age === 'number', 'user.age should be a number')
      },
    },
    {
      name: 'call tool with only required parameter omitting the optional one',
      run: async () => {
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
            { type: 'humanMessage', humanMessage: { text: 'Search for red running shoes' } },
          ],
        })

        const functionCallItem = nextItems.find((x) => x.type === 'functionCall')
        ensure(functionCallItem != null, 'nextItems should contain a functionCall item')
        ensure(
          functionCallItem.functionCall.name === 'searchProducts',
          'function call should target searchProducts',
        )

        const args = JSON.parse(functionCallItem.functionCall.arguments ?? '{}')
        ensure(typeof args.query === 'string' && args.query.length > 0, 'query should be a string')
      },
    },
    {
      name: 'call tool with no parameters',
      run: async () => {
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
        ensure(functionCallItem != null, 'nextItems should contain a functionCall item')
        ensure(
          functionCallItem.functionCall.name === 'getCurrentServerTime',
          'function call should target getCurrentServerTime',
        )
      },
    },
  ]
}
