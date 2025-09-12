import { describe, test, mock, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert'
import { DeepSeekChatAdapter } from './DeepSeekChatAdapter'
import { IChatAdapterNextItemReq } from '@/feature/chat-bot'
import { container } from '@/core/injection'

describe('DeepSeekChatAdapter', () => {
  let adapter: DeepSeekChatAdapter
  let mockDeepSeek: any
  let originalApiKey: string | undefined
  let originalBaseUrl: string | undefined

  beforeEach(() => {
    originalApiKey = process.env.DEEPSEEK_API_KEY
    originalBaseUrl = process.env.DEEPSEEK_BASE_URL
    process.env.DEEPSEEK_API_KEY = 'test-api-key'
    process.env.DEEPSEEK_BASE_URL = 'https://api.deepseek.com'

    mockDeepSeek = {
      chat: {
        completions: {
          create: mock.fn(),
        },
      },
    }

    adapter = container.resolve(DeepSeekChatAdapter)
    adapter['deepSeek'] = mockDeepSeek
    adapter['logger'] = {
      debuggers: {},
      trace: mock.fn(),
      debug: mock.fn(),
      info: mock.fn(),
      warn: mock.fn(),
      error: mock.fn(),
      fatal: mock.fn(),
    } as any
  })

  afterEach(() => {
    if (originalApiKey !== undefined) {
      process.env.DEEPSEEK_API_KEY = originalApiKey
    } else {
      delete process.env.DEEPSEEK_API_KEY
    }
    if (originalBaseUrl !== undefined) {
      process.env.DEEPSEEK_BASE_URL = originalBaseUrl
    } else {
      delete process.env.DEEPSEEK_BASE_URL
    }
    mock.restoreAll()
  })

  test('should handle simple text request correctly', async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            content: 'Hello! How can I help you today?',
            tool_calls: null,
          },
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 15 },
    }
    mockDeepSeek.chat.completions.create.mock.mockImplementation(() =>
      Promise.resolve(mockResponse),
    )

    const req: IChatAdapterNextItemReq = {
      model: 'deepseek-chat',
      systemPrompt: 'You are a helpful assistant',
      tools: [],
      prevItems: [
        {
          type: 'humanMessage',
          humanMessage: {
            text: 'Hello',
            chatConnection: {} as any,
            userConnection: {} as any,
          },
        },
      ],
    }

    const result = await adapter.nextItem(req)

    assert.strictEqual(mockDeepSeek.chat.completions.create.mock.callCount(), 1)
    const callArgs = mockDeepSeek.chat.completions.create.mock.calls[0].arguments[0]

    assert.strictEqual(callArgs.model, 'deepseek-chat')
    assert.strictEqual(callArgs.tool_choice, 'auto')
    assert.deepStrictEqual(callArgs.messages, [
      { role: 'system', content: 'You are a helpful assistant' },
      { role: 'user', content: 'Hello' },
    ])
    assert.deepStrictEqual(callArgs.tools, [])

    assert.deepStrictEqual(result, {
      chatItem: {
        type: 'botMessage',
        botMessage: { text: 'Hello! How can I help you today?' },
      },
      usage: { inputTokens: 10, outputTokens: 15 },
    })
  })

  test('should handle tool usage correctly', async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            content: null,
            tool_calls: [
              {
                id: 'call_abc123',
                type: 'function',
                function: {
                  name: 'calculate',
                  arguments: '{"expression":"2 + 2"}',
                },
              },
            ],
          },
        },
      ],
      usage: { prompt_tokens: 25, completion_tokens: 8 },
    }
    mockDeepSeek.chat.completions.create.mock.mockImplementation(() =>
      Promise.resolve(mockResponse),
    )

    const req: IChatAdapterNextItemReq = {
      model: 'deepseek-chat',
      systemPrompt: 'You are a helpful assistant',
      tools: [
        {
          language: 'typescript',
          name: 'calculate',
          description: 'Calculate mathematical expressions',
          parameters: [
            {
              type: 'string',
              name: 'expression',
              description: 'Mathematical expression to calculate',
            },
          ],
        },
      ],
      prevItems: [
        {
          type: 'humanMessage',
          humanMessage: {
            text: 'What is 2 + 2?',
            chatConnection: {} as any,
            userConnection: {} as any,
          },
        },
      ],
    }

    const result = await adapter.nextItem(req)

    const callArgs = mockDeepSeek.chat.completions.create.mock.calls[0].arguments[0]
    assert.strictEqual(callArgs.tools.length, 1)
    assert.strictEqual(callArgs.tools[0].function.name, 'calculate')
    assert.strictEqual(callArgs.tools[0].function.description, 'Calculate mathematical expressions')

    assert.deepStrictEqual(result, {
      chatItem: {
        type: 'functionCall',
        functionCall: {
          id: 'call_abc123',
          name: 'calculate',
          arguments: '{"expression":"2 + 2"}',
        },
      },
      usage: { inputTokens: 25, outputTokens: 8 },
    })
  })
})