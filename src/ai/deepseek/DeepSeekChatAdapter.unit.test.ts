import { describe, it, mock, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert'
import { DeepSeekChatAdapter } from './DeepSeekChatAdapter'
import { IChatAdapterNextItemReq } from '@/chatbot'

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

    adapter = new DeepSeekChatAdapter()
    // Override the deepSeek client after construction
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

  describe('constructor', () => {
    it('should throw error when DEEPSEEK_API_KEY is not provided', () => {
      delete process.env.DEEPSEEK_API_KEY

      assert.throws(() => new DeepSeekChatAdapter(), {
        message: 'DEEPSEEK_API_KEY env variable is required',
      })

      process.env.DEEPSEEK_API_KEY = 'test-api-key'
    })

    it('should throw error when DEEPSEEK_BASE_URL is not provided', () => {
      delete process.env.DEEPSEEK_BASE_URL

      assert.throws(() => new DeepSeekChatAdapter(), {
        message: 'DEEPSEEK_BASE_URL env variable is required',
      })

      process.env.DEEPSEEK_BASE_URL = 'https://api.deepseek.com'
    })
  })

  describe('nextItem', () => {
    it('should call DeepSeek API with correct parameters for simple request', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Test response',
              tool_calls: null,
            },
          },
        ],
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
            type: 'CONNECTION_MESSAGE',
            content: {
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
        type: 'BOT_MESSAGE',
        content: { text: 'Test response' },
      })
    })

    it('should handle tools in request', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                {
                  id: 'tool_123',
                  type: 'function',
                  function: {
                    name: 'test_tool',
                    arguments: '{"param":"value"}',
                  },
                },
              ],
            },
          },
        ],
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
            name: 'test_tool',
            description: 'A test tool',
            parameters: [
              {
                type: 'string',
                name: 'param',
                description: 'A parameter',
              },
            ],
          },
        ],
        prevItems: [],
      }

      const result = await adapter.nextItem(req)

      const callArgs = mockDeepSeek.chat.completions.create.mock.calls[0].arguments[0]
      assert.strictEqual(callArgs.tools.length, 1)
      assert.deepStrictEqual(callArgs.tools[0], {
        type: 'function',
        function: {
          name: 'test_tool',
          description: 'A test tool',
          parameters: {
            type: 'object',
            properties: {
              param: { type: 'string', description: 'A parameter' },
            },
            required: ['param'],
            additionalProperties: false,
          },
          strict: true,
        },
      })

      assert.deepStrictEqual(result, {
        type: 'FUNCTION_CALL',
        content: {
          id: 'tool_123',
          name: 'test_tool',
          arguments: '{"param":"value"}',
        },
      })
    })

    it('should handle function call in previous items', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Function result processed',
              tool_calls: null,
            },
          },
        ],
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
            type: 'FUNCTION_CALL',
            content: {
              id: 'call_123',
              name: 'test_function',
              arguments: '{"param":"value"}',
              result: 'Function executed successfully',
            },
          },
        ],
      }

      await adapter.nextItem(req)

      const callArgs = mockDeepSeek.chat.completions.create.mock.calls[0].arguments[0]
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
              name: 'test_function',
              arguments: '{"param":"value"}',
            },
          },
        ],
      })
      assert.deepStrictEqual(callArgs.messages[2], {
        role: 'tool',
        tool_call_id: 'call_123',
        content: 'Function executed successfully',
      })
    })

    it('should throw error for empty user message', async () => {
      const req: IChatAdapterNextItemReq = {
        model: 'deepseek-chat',
        systemPrompt: 'You are a helpful assistant',
        tools: [],
        prevItems: [
          {
            type: 'CONNECTION_MESSAGE',
            content: {
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

    it('should throw error for empty bot message', async () => {
      const req: IChatAdapterNextItemReq = {
        model: 'deepseek-chat',
        systemPrompt: 'You are a helpful assistant',
        tools: [],
        prevItems: [
          {
            type: 'BOT_MESSAGE',
            content: { text: '' },
          },
        ],
      }

      await assert.rejects(() => adapter.nextItem(req), {
        message: 'Assistant message content is empty',
      })
    })

    it('should throw error for unsupported DeepSeek response', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: null,
              tool_calls: null,
            },
          },
        ],
      }
      mockDeepSeek.chat.completions.create.mock.mockImplementation(() =>
        Promise.resolve(mockResponse),
      )

      const req: IChatAdapterNextItemReq = {
        model: 'deepseek-chat',
        systemPrompt: 'You are a helpful assistant',
        tools: [],
        prevItems: [],
      }

      await assert.rejects(() => adapter.nextItem(req), {
        message: 'Not supported DeepSeek Response',
      })
    })

    it('should handle function call result with null result', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Function result processed',
              tool_calls: null,
            },
          },
        ],
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
            type: 'FUNCTION_CALL',
            content: {
              id: 'call_123',
              name: 'test_function',
              arguments: '{"param":"value"}',
              result: undefined,
            },
          },
        ],
      }

      await adapter.nextItem(req)

      const callArgs = mockDeepSeek.chat.completions.create.mock.calls[0].arguments[0]
      assert.deepStrictEqual(callArgs.messages[2], {
        role: 'tool',
        tool_call_id: 'call_123',
        content: 'No result',
      })
    })
  })
})
