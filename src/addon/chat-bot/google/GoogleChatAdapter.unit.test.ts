import { describe, test, mock, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert'
import { GoogleChatAdapter } from './GoogleChatAdapter'
import { IChatAdapterNextItemReq } from '@/feature/chat-bot'
import { Env } from '@/core/env'

describe('GoogleChatAdapter', () => {
  let adapter: GoogleChatAdapter
  let mockOpenAI: any
  let mockEnv: Env
  let originalApiKey: string | undefined

  beforeEach(() => {
    originalApiKey = process.env.GOOGLE_API_KEY
    process.env.GOOGLE_API_KEY = 'test-api-key'

    mockOpenAI = {
      chat: {
        completions: {
          create: mock.fn(),
        },
      },
    }

    mockEnv = {
      requireString: mock.fn(() => 'test-api-key'),
    } as any

    adapter = new GoogleChatAdapter(mockEnv)
    adapter['openai'] = mockOpenAI  // Updated from 'genai' to 'openai'
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
      process.env.GOOGLE_API_KEY = originalApiKey
    } else {
      delete process.env.GOOGLE_API_KEY
    }
    mock.restoreAll()
  })

  test('should require GOOGLE_API_KEY in constructor', () => {
    const mockEnvWithoutKey = {
      requireString: mock.fn(() => {
        throw new Error('Env Variable GOOGLE_API_KEY is required')
      }),
    } as any

    assert.throws(() => new GoogleChatAdapter(mockEnvWithoutKey), {
      message: 'Env Variable GOOGLE_API_KEY is required',
    })
  })

  test('should handle simple text request with OpenAI format', async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            content: 'Hello! How can I help you today?',
            tool_calls: null,
          },
        },
      ],
      usage: { prompt_tokens: 15, completion_tokens: 10 },
    }
    mockOpenAI.chat.completions.create.mock.mockImplementation(() => Promise.resolve(mockResponse))

    const req: IChatAdapterNextItemReq = {
      model: 'gemini-2.0-flash',
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

    assert.strictEqual(mockOpenAI.chat.completions.create.mock.callCount(), 1)
    const callArgs = mockOpenAI.chat.completions.create.mock.calls[0].arguments[0]

    // Verify OpenAI format structure
    assert.strictEqual(callArgs.model, 'gemini-2.0-flash')
    assert.deepStrictEqual(callArgs.messages, [
      { role: 'system', content: 'You are a helpful assistant' },
      { role: 'user', content: 'Hello' },
    ])
    assert.strictEqual(callArgs.tools, undefined)

    assert.deepStrictEqual(result, {
      chatItem: {
        type: 'botMessage',
        botMessage: { text: 'Hello! How can I help you today?' },
      },
      usage: { inputTokens: 15, outputTokens: 10 },
    })
  })

  test('should handle tool usage with OpenAI format', async () => {
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
      usage: { prompt_tokens: 30, completion_tokens: 5 },
    }
    mockOpenAI.chat.completions.create.mock.mockImplementation(() => Promise.resolve(mockResponse))

    const req: IChatAdapterNextItemReq = {
      model: 'gemini-2.0-flash',
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

    const callArgs = mockOpenAI.chat.completions.create.mock.calls[0].arguments[0]
    assert.strictEqual(callArgs.tools.length, 1)
    assert.deepStrictEqual(callArgs.tools[0], {
      type: 'function',
      function: {
        name: 'calculate',
        description: 'Calculate mathematical expressions',
        parameters: {
          type: 'object',
          properties: {
            expression: { type: 'string', description: 'Mathematical expression to calculate' },
          },
          required: ['expression'],
          additionalProperties: false,
        },
        strict: true,
      },
    })

    assert.deepStrictEqual(result, {
      chatItem: {
        type: 'functionCall',
        functionCall: {
          id: 'call_abc123',
          name: 'calculate',
          arguments: '{"expression":"2 + 2"}',
        },
      },
      usage: { inputTokens: 30, outputTokens: 5 },
    })
  })

  test('should handle function call in previous items', async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            content: 'The result is 4',
            tool_calls: null,
          },
        },
      ],
      usage: { prompt_tokens: 25, completion_tokens: 8 },
    }
    mockOpenAI.chat.completions.create.mock.mockImplementation(() => Promise.resolve(mockResponse))

    const req: IChatAdapterNextItemReq = {
      model: 'gemini-2.0-flash',
      systemPrompt: 'You are a helpful assistant',
      tools: [],
      prevItems: [
        {
          type: 'functionCall',
          functionCall: {
            id: 'call_123',
            name: 'calculate',
            arguments: '{"expression":"2 + 2"}',
            result: '4',
          },
        },
      ],
    }

    await adapter.nextItem(req)

    const callArgs = mockOpenAI.chat.completions.create.mock.calls[0].arguments[0]
    assert.strictEqual(callArgs.messages.length, 3)
    assert.deepStrictEqual(callArgs.messages[0], {
      role: 'system',
      content: 'You are a helpful assistant',
    })
    assert.deepStrictEqual(callArgs.messages[1], {
      role: 'assistant',
      tool_calls: [
        {
          id: 'call_123',
          type: 'function',
          function: {
            name: 'calculate',
            arguments: '{"expression":"2 + 2"}',
          },
        },
      ],
    })
    assert.deepStrictEqual(callArgs.messages[2], {
      role: 'tool',
      tool_call_id: 'call_123',
      content: '4',
    })
  })

  test('should throw error for empty user message', async () => {
    const req: IChatAdapterNextItemReq = {
      model: 'gemini-2.0-flash',
      systemPrompt: 'You are a helpful assistant',
      tools: [],
      prevItems: [
        {
          type: 'humanMessage',
          humanMessage: {
            text: '',
            chatConnection: {} as any,
            userConnection: {} as any,
          },
        },
      ],
    }

    await assert.rejects(() => adapter.nextItem(req), {
      message: 'User message content is empty',
    })
  })

  test('should throw error for unsupported Gemini response', async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            content: null,
            tool_calls: null,
          },
        },
      ],
      usage: { prompt_tokens: 5, completion_tokens: 0 },
    }
    mockOpenAI.chat.completions.create.mock.mockImplementation(() => Promise.resolve(mockResponse))

    const req: IChatAdapterNextItemReq = {
      model: 'gemini-2.0-flash',
      systemPrompt: 'You are a helpful assistant',
      tools: [],
      prevItems: [],
    }

    await assert.rejects(() => adapter.nextItem(req), {
      message: 'Not supported Gemini Response',
    })
  })
})